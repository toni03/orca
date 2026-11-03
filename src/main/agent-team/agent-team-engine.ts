import { randomUUID } from 'node:crypto'
import {
  applyAgentTeamSessionStop,
  applyAgentTeamStepResult,
  applyAgentTeamUserDecision,
  openAssignment,
  previousRoundFindings,
  stepRole,
  type AgentTeamUserDecision
} from '../../shared/agent-team/agent-team-pipeline'
import { planAgentTeamAssignments } from '../../shared/agent-team/agent-team-scheduler'
import { composeAgentTeamSessionPrompt } from '../../shared/agent-team/agent-team-session-prompt'
import type {
  AgentTeamAssignment,
  AgentTeamIssue,
  AgentTeamProject,
  AgentTeamSeat,
  AgentTeamState,
  AgentTeamStepResult
} from '../../shared/agent-team/agent-team-types'
import type { AgentTeamStore } from './agent-team-store'

/** What the engine needs from Orca to start a seat's session. */
export type AgentTeamLauncher = {
  /** Build step without a worktree yet: create one and start the agent in it. */
  launchInNewWorktree(args: {
    repoId: string
    name: string
    seat: AgentTeamSeat
    prompt: string
    title: string
  }): Promise<{ worktreeId: string; branch?: string; terminalHandle: string }>
  /** Any later step: start the agent in the issue's worktree. */
  launchInWorktree(args: {
    worktreeId: string
    seat: AgentTeamSeat
    prompt: string
    title: string
  }): Promise<{ terminalHandle: string }>
  readProjectSpec(project: AgentTeamProject | undefined, repoId: string): Promise<string | null>
  /** Resolves when the session's process exits. */
  watchExit(terminalHandle: string, onExit: () => void): void
}

export class AgentTeamError extends Error {
  constructor(
    readonly code: 'not_found' | 'invalid_state' | 'invalid_argument',
    message: string
  ) {
    super(message)
  }
}

function worktreeName(issue: AgentTeamIssue): string {
  const key = (issue.tracker?.key ?? issue.id.slice(0, 8)).replace(/[^A-Za-z0-9]+/g, '')
  const slug = issue.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return [key.toLowerCase(), slug].filter(Boolean).join('-') || `team-${issue.id.slice(0, 8)}`
}

function replaceIssue(state: AgentTeamState, next: AgentTeamIssue): AgentTeamState {
  return { ...state, issues: state.issues.map((issue) => (issue.id === next.id ? next : issue)) }
}

export class AgentTeamEngine {
  private ticking = false
  private tickAgain = false

  constructor(
    private readonly store: AgentTeamStore,
    private readonly launcher: AgentTeamLauncher,
    private readonly now: () => number = Date.now
  ) {}

  /** Starts every assignment the scheduler can make now; safe to call often. */
  async tick(): Promise<void> {
    if (this.ticking) {
      this.tickAgain = true
      return
    }
    this.ticking = true
    try {
      do {
        this.tickAgain = false
        const plan = planAgentTeamAssignments(this.store.get())
        await Promise.all(
          plan.assignments.map((planned) =>
            this.start(planned.issueId, planned.seatId, planned.stepId)
          )
        )
      } while (this.tickAgain)
    } finally {
      this.ticking = false
    }
  }

  private async start(issueId: string, seatId: string, stepId: string): Promise<void> {
    const state = this.store.get()
    const issue = state.issues.find((candidate) => candidate.id === issueId)
    const team = state.teams.find((candidate) => candidate.id === issue?.teamId)
    const seat = state.seats.find((candidate) => candidate.id === seatId)
    const role = team && issue ? stepRole(team, issue.stepIndex, state.roles) : undefined
    if (!issue || !team || !seat || !role) {
      return
    }
    const assignment: AgentTeamAssignment = {
      id: randomUUID(),
      seatId,
      stepId,
      round: issue.round,
      roleVersion: role.version,
      startedAt: this.now()
    }
    // Record the assignment before launching so the next tick cannot double-book the seat.
    this.store.update((current) =>
      replaceIssue(current, {
        ...issue,
        status: 'working',
        assignments: [...issue.assignments, assignment],
        updatedAt: assignment.startedAt
      })
    )
    const project = state.projects.find((candidate) => candidate.repoId === issue.repoId)
    const step = team.steps[issue.stepIndex]
    const title = `${seat.name} · ${issue.tracker?.key ?? issue.title}`
    try {
      const prompt = composeAgentTeamSessionPrompt({
        role,
        seat,
        issue,
        assignment,
        projectSpec: await this.launcher.readProjectSpec(project, issue.repoId),
        previousFindings: role.stepType === 'build' ? previousRoundFindings(issue) : null
      })
      if (issue.worktreeId) {
        const launched = await this.launcher.launchInWorktree({
          worktreeId: issue.worktreeId,
          seat,
          prompt,
          title
        })
        this.recordLaunch(issue.id, assignment.id, launched.terminalHandle, {})
      } else {
        if (role.stepType !== 'build') {
          throw new Error(
            `Step "${step?.name}" checks a worktree, but no Build step has created one.`
          )
        }
        const launched = await this.launcher.launchInNewWorktree({
          repoId: issue.repoId,
          name: worktreeName(issue),
          seat,
          prompt,
          title
        })
        this.recordLaunch(issue.id, assignment.id, launched.terminalHandle, {
          worktreeId: launched.worktreeId,
          ...(launched.branch ? { branch: launched.branch } : {})
        })
      }
    } catch (error) {
      this.stopAssignment(
        assignment.id,
        'launch-failed',
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  private recordLaunch(
    issueId: string,
    assignmentId: string,
    terminalHandle: string,
    issuePatch: Partial<AgentTeamIssue>
  ): void {
    this.store.update((current) => {
      const issue = current.issues.find((candidate) => candidate.id === issueId)
      if (!issue) {
        return current
      }
      return replaceIssue(current, {
        ...issue,
        ...issuePatch,
        assignments: issue.assignments.map((assignment) =>
          assignment.id === assignmentId ? { ...assignment, terminalHandle } : assignment
        )
      })
    })
    this.launcher.watchExit(terminalHandle, () => {
      this.stopAssignment(assignmentId, 'exited', 'The session ended without reporting a result.')
    })
  }

  private findOpen(
    assignmentId: string
  ): { issue: AgentTeamIssue; assignment: AgentTeamAssignment } | null {
    for (const issue of this.store.get().issues) {
      const assignment = openAssignment(issue)
      if (assignment?.id === assignmentId) {
        return { issue, assignment }
      }
    }
    return null
  }

  /** A seat's `orca team report`. */
  report(assignmentId: string, result: AgentTeamStepResult): AgentTeamIssue {
    const found = this.findOpen(assignmentId)
    if (!found) {
      throw new AgentTeamError('not_found', `No running assignment ${assignmentId}.`)
    }
    const state = this.store.get()
    const team = state.teams.find((candidate) => candidate.id === found.issue.teamId)
    const role = team ? stepRole(team, found.issue.stepIndex, state.roles) : undefined
    if (!team || !role) {
      throw new AgentTeamError('invalid_state', 'The issue no longer has this step.')
    }
    const expected = role.stepType === 'build' ? ['done', 'blocked'] : ['pass', 'changes']
    if (!expected.includes(result.kind)) {
      throw new AgentTeamError(
        'invalid_argument',
        `A ${role.stepType} step reports ${expected.join(' or ')}, not ${result.kind}.`
      )
    }
    const next = applyAgentTeamStepResult({
      issue: found.issue,
      team,
      roles: state.roles,
      workflow: state.workflow,
      assignmentId,
      result,
      now: this.now()
    })
    this.store.update((current) => replaceIssue(current, next))
    void this.tick()
    return next
  }

  /** The session waits for input, finished its turn without reporting, or exited. */
  stopAssignment(
    assignmentId: string,
    reason: NonNullable<AgentTeamAssignment['stopReason']>,
    detail: string
  ): void {
    const found = this.findOpen(assignmentId)
    if (!found) {
      return
    }
    const next = applyAgentTeamSessionStop({
      issue: found.issue,
      assignmentId,
      reason,
      detail,
      now: this.now()
    })
    this.store.update((current) => replaceIssue(current, next))
    if (reason !== 'needs-input') {
      void this.tick()
    }
  }

  /** Someone answered the waiting session in its terminal, so it is working again. */
  resumeAssignment(assignmentId: string): void {
    const found = this.findOpen(assignmentId)
    if (
      !found ||
      found.issue.status !== 'needs-you' ||
      found.issue.needsYou?.reason !== 'question'
    ) {
      return
    }
    const resumed: AgentTeamIssue = {
      ...found.issue,
      status: 'working',
      needsYou: undefined,
      updatedAt: this.now()
    }
    this.store.update((current) => replaceIssue(current, resumed))
  }

  assignmentForTerminal(terminalHandle: string): AgentTeamAssignment | null {
    for (const issue of this.store.get().issues) {
      const assignment = openAssignment(issue)
      if (assignment?.terminalHandle === terminalHandle) {
        return assignment
      }
    }
    return null
  }

  decide(issueId: string, decision: AgentTeamUserDecision): AgentTeamIssue {
    const state = this.store.get()
    const issue = state.issues.find((candidate) => candidate.id === issueId)
    const team = state.teams.find((candidate) => candidate.id === issue?.teamId)
    if (!issue || !team) {
      throw new AgentTeamError('not_found', `No issue ${issueId}.`)
    }
    if (decision.kind !== 'discard' && issue.status !== 'needs-you') {
      throw new AgentTeamError('invalid_state', 'Only issues waiting for you take this decision.')
    }
    const next = applyAgentTeamUserDecision({
      issue,
      team,
      roles: state.roles,
      decision,
      now: this.now()
    })
    this.store.update((current) => replaceIssue(current, next))
    void this.tick()
    return next
  }
}
