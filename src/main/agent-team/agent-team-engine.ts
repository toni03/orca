import { randomUUID } from 'node:crypto'
import {
  applyAgentTeamSessionStop,
  applyAgentTeamStepResult,
  applyAgentTeamUserDecision,
  findOpenAssignment,
  openAssignment,
  replaceAgentTeamIssue,
  stepRole,
  type AgentTeamUserDecision
} from '../../shared/agent-team/agent-team-pipeline'
import { planAgentTeamAssignments } from '../../shared/agent-team/agent-team-scheduler'
import type {
  AgentTeamAssignment,
  AgentTeamIssue,
  AgentTeamStepResult
} from '../../shared/agent-team/agent-team-types'
import {
  agentTeamStepPrompt,
  agentTeamWorktreeName,
  closeAgentTeamSession,
  removeFinishedAgentTeamWorktree,
  type AgentTeamLauncher
} from './agent-team-launcher'
import { recoverUnreportedBuild } from './agent-team-unreported-recovery'
import type { AgentTeamStore } from './agent-team-store'

export class AgentTeamError extends Error {
  constructor(
    readonly code: 'not_found' | 'invalid_state' | 'invalid_argument',
    message: string
  ) {
    super(message)
  }
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
      replaceAgentTeamIssue(current, {
        ...issue,
        status: 'working',
        assignments: [...issue.assignments, assignment],
        updatedAt: assignment.startedAt
      })
    )
    const project = state.projects.find((candidate) => candidate.repoId === issue.repoId)
    const step = team.steps[issue.stepIndex]
    const title = `${seat.name} · ${issue.tracker?.key ?? issue.title}`
    const baseBranch = project?.baseBranch?.trim() || undefined
    try {
      const prompt = await agentTeamStepPrompt(this.launcher, {
        role,
        seat,
        issue,
        assignment,
        project
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
          name: agentTeamWorktreeName(issue),
          ...(baseBranch ? { baseBranch } : {}),
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
      return replaceAgentTeamIssue(current, {
        ...issue,
        ...issuePatch,
        assignments: issue.assignments.map((assignment) =>
          assignment.id === assignmentId ? { ...assignment, terminalHandle } : assignment
        )
      })
    })
    this.launcher.watchExit(
      terminalHandle,
      () =>
        void this.stopUnreported(
          assignmentId,
          'exited',
          'The session ended without reporting a result.'
        )
    )
  }

  /** Stopped without `orca team report`: keep a delivered merge request, otherwise ask the user. */
  async stopUnreported(
    assignmentId: string,
    reason: NonNullable<AgentTeamAssignment['stopReason']>,
    detail: string
  ): Promise<void> {
    const recovered = await recoverUnreportedBuild(this.launcher, this.store.get(), assignmentId)
    if (recovered && this.findOpen(assignmentId)) {
      this.report(assignmentId, recovered)
      return
    }
    this.stopAssignment(assignmentId, reason, detail)
  }

  private findOpen(assignmentId: string) {
    return findOpenAssignment(
      this.store.get().issues,
      (assignment) => assignment.id === assignmentId
    )
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
    this.store.update((current) => replaceAgentTeamIssue(current, next))
    // The step is over: its record lives in the issue history and the tracker, not an open tab.
    closeAgentTeamSession(this.launcher, found.assignment)
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
    this.store.update((current) => replaceAgentTeamIssue(current, next))
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
    this.store.update((current) => replaceAgentTeamIssue(current, resumed))
  }

  assignmentForTerminal(terminalHandle: string): AgentTeamAssignment | null {
    return (
      findOpenAssignment(
        this.store.get().issues,
        (assignment) => assignment.terminalHandle === terminalHandle
      )?.assignment ?? null
    )
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
    const waiting = openAssignment(issue)
    if (decision.kind === 'answer' && waiting?.terminalHandle && decision.note.trim()) {
      // The session is still open and asking: answer it there so it keeps its context.
      const sent = this.launcher.sendToSession(waiting.terminalHandle, decision.note.trim())
      void sent.catch((error: unknown) =>
        this.stopAssignment(waiting.id, 'errored', `Could not send the answer: ${String(error)}`)
      )
      const resumed: AgentTeamIssue = {
        ...issue,
        status: 'working',
        needsYou: undefined,
        updatedAt: this.now()
      }
      this.store.update((current) => replaceAgentTeamIssue(current, resumed))
      return resumed
    }
    const next = applyAgentTeamUserDecision({
      issue,
      team,
      roles: state.roles,
      decision,
      now: this.now()
    })
    this.store.update((current) => replaceAgentTeamIssue(current, next))
    if (decision.kind !== 'resume' && waiting) {
      closeAgentTeamSession(this.launcher, waiting)
    }
    removeFinishedAgentTeamWorktree(this.launcher, next)
    void this.tick()
    return next
  }
}
