import type {
  AgentTeam,
  AgentTeamAssignment,
  AgentTeamIssue,
  AgentTeamRole,
  AgentTeamStepResult,
  AgentTeamWorkflow
} from './agent-team-types'

export function openAssignment(issue: AgentTeamIssue): AgentTeamAssignment | undefined {
  return issue.assignments.find((assignment) => assignment.endedAt === undefined)
}

export function stepRole(
  team: AgentTeam,
  stepIndex: number,
  roles: readonly AgentTeamRole[]
): AgentTeamRole | undefined {
  const step = team.steps[stepIndex]
  return step ? roles.find((role) => role.id === step.roleId) : undefined
}

/** A rejected check returns to the closest Build step before it, or the first step. */
export function reworkStepIndex(
  team: AgentTeam,
  fromIndex: number,
  roles: readonly AgentTeamRole[]
): number {
  for (let index = fromIndex - 1; index >= 0; index -= 1) {
    if (stepRole(team, index, roles)?.stepType === 'build') {
      return index
    }
  }
  return 0
}

function advance(issue: AgentTeamIssue, team: AgentTeam, now: number): AgentTeamIssue {
  const next = issue.stepIndex + 1
  if (next >= team.steps.length) {
    return {
      ...issue,
      stepIndex: team.steps.length,
      status: 'needs-you',
      needsYou: { reason: 'ready', detail: 'Every step passed.', at: now },
      updatedAt: now
    }
  }
  return { ...issue, stepIndex: next, status: 'working', needsYou: undefined, updatedAt: now }
}

function formatQuestions(questions: readonly string[] | undefined): string {
  return questions && questions.length > 0 ? `\n${questions.map((q) => `- ${q}`).join('\n')}` : ''
}

function closeAssignment(
  issue: AgentTeamIssue,
  assignmentId: string,
  patch: Partial<AgentTeamAssignment>,
  now: number
): AgentTeamIssue {
  return {
    ...issue,
    assignments: issue.assignments.map((assignment) =>
      assignment.id === assignmentId ? { ...assignment, ...patch, endedAt: now } : assignment
    )
  }
}

/** Moves an issue through its team's pipeline after a seat reports. */
export function applyAgentTeamStepResult(args: {
  issue: AgentTeamIssue
  team: AgentTeam
  roles: readonly AgentTeamRole[]
  workflow: AgentTeamWorkflow
  assignmentId: string
  result: AgentTeamStepResult
  now: number
}): AgentTeamIssue {
  const { team, roles, workflow, result, now } = args
  const issue = closeAssignment(args.issue, args.assignmentId, { result }, now)
  switch (result.kind) {
    case 'done':
      return advance(
        result.mergeRequestUrl
          ? { ...issue, mergeRequest: { url: result.mergeRequestUrl } }
          : issue,
        team,
        now
      )
    case 'pass':
      return advance(issue, team, now)
    case 'blocked':
      return {
        ...issue,
        status: 'needs-you',
        needsYou: {
          reason: 'blocked',
          detail: `${result.summary}${formatQuestions(result.questions)}`,
          at: now
        },
        updatedAt: now
      }
    case 'changes':
      if (issue.round >= workflow.roundsPerIssue) {
        return {
          ...issue,
          status: 'needs-you',
          needsYou: {
            reason: 'escalated',
            detail: `${issue.round}/${workflow.roundsPerIssue} rounds used. ${result.summary}`,
            at: now
          },
          updatedAt: now
        }
      }
      return {
        ...issue,
        round: issue.round + 1,
        stepIndex: reworkStepIndex(team, issue.stepIndex, roles),
        status: 'working',
        needsYou: undefined,
        updatedAt: now
      }
  }
}

/** A session stopped without reporting: hand it to the user instead of guessing. */
export function applyAgentTeamSessionStop(args: {
  issue: AgentTeamIssue
  assignmentId: string
  reason: NonNullable<AgentTeamAssignment['stopReason']>
  detail: string
  now: number
}): AgentTeamIssue {
  const { reason, detail, now } = args
  if (reason === 'needs-input') {
    // The session is still alive and waiting; keep the assignment open so a later report lands.
    return {
      ...args.issue,
      status: 'needs-you',
      needsYou: { reason: 'question', detail, at: now },
      updatedAt: now
    }
  }
  const issue = closeAssignment(
    args.issue,
    args.assignmentId,
    { stopReason: reason, stopDetail: detail },
    now
  )
  return {
    ...issue,
    status: 'needs-you',
    needsYou: { reason: 'failed', detail, at: now },
    updatedAt: now
  }
}

export type AgentTeamUserDecision =
  | { kind: 'resume' }
  /** Answers a blocked or stopped step; the same step runs again with the answer. */
  | { kind: 'answer'; note: string }
  | { kind: 'request-changes'; note: string }
  | { kind: 'done' }
  | { kind: 'discard' }

/** The user's answer to a Needs you item. */
export function applyAgentTeamUserDecision(args: {
  issue: AgentTeamIssue
  team: AgentTeam
  roles: readonly AgentTeamRole[]
  decision: AgentTeamUserDecision
  now: number
}): AgentTeamIssue {
  const { team, roles, decision, now } = args
  const open = openAssignment(args.issue)
  // Every decision but resume ends the session that was waiting, so its late report is ignored.
  // The engine sends an answer straight to a session that is still waiting instead.
  const issue =
    open && decision.kind !== 'resume'
      ? closeAssignment(args.issue, open.id, { stopReason: 'cancelled' }, now)
      : args.issue
  const base = { ...issue, needsYou: undefined, updatedAt: now }
  switch (decision.kind) {
    case 'resume':
      if (open) {
        return { ...base, status: 'working' }
      }
      return {
        ...base,
        status: 'working',
        stepIndex: Math.min(issue.stepIndex, team.steps.length - 1)
      }
    case 'answer': {
      const note = decision.note.trim()
      return {
        ...base,
        status: 'working',
        stepIndex: Math.min(issue.stepIndex, team.steps.length - 1),
        body: note ? `${issue.body.trim()}\n\nAnswer from the user:\n${note}` : issue.body
      }
    }
    case 'request-changes': {
      const from = Math.min(issue.stepIndex, team.steps.length)
      const note = decision.note.trim()
      return {
        ...base,
        status: 'working',
        round: issue.round + 1,
        stepIndex: reworkStepIndex(team, from, roles),
        body: note
          ? `${issue.body.trim()}\n\nRequested changes (round ${issue.round + 1}):\n${note}`
          : issue.body
      }
    }
    case 'done':
      return { ...base, status: 'done' }
    case 'discard':
      return { ...base, status: 'discarded' }
  }
}

/** Findings from the last rejected check, as text for the next Build round. */
export function previousRoundFindings(issue: AgentTeamIssue): string | null {
  for (let index = issue.assignments.length - 1; index >= 0; index -= 1) {
    const result = issue.assignments[index].result
    if (result?.kind === 'changes') {
      const findings = result.findings.map((finding) => {
        const where = finding.file
          ? ` (${finding.file}${finding.line ? `:${finding.line}` : ''})`
          : ''
        return `- [${finding.severity}] ${finding.message}${where}`
      })
      return [result.summary, ...findings].join('\n')
    }
  }
  return null
}
