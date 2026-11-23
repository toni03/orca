import { stepRole } from './agent-team-pipeline'
import type { AgentTeamIssue, AgentTeamState, AgentTeamTrackerEvent } from './agent-team-types'

const MAX_PENDING_EVENTS = 100

/** Where an issue stands, in words the Manager can map to tracker labels through the project spec. */
export function describeIssuePosition(issue: AgentTeamIssue, state: AgentTeamState): string {
  switch (issue.status) {
    case 'registered':
      return 'registered, not approved yet'
    case 'queued':
      return issue.assignments.length === 0
        ? 'approved, waiting in the queue'
        : 'waiting for its next step'
    case 'working': {
      const team = state.teams.find((candidate) => candidate.id === issue.teamId)
      const step = team?.steps[issue.stepIndex]
      const role = team ? stepRole(team, issue.stepIndex, state.roles) : undefined
      const kind = role?.stepType === 'check' ? 'Check' : 'Build'
      return `in ${kind} step "${step?.name ?? '?'}" (role ${role?.name ?? '?'}, round ${issue.round})`
    }
    case 'needs-you':
      return `waiting for the user (${issue.needsYou?.reason ?? 'review'})`
    case 'done':
      return 'done, accepted by the user'
    case 'discarded':
      return 'discarded by the user'
  }
}

function positionKey(issue: AgentTeamIssue): string {
  return `${issue.status}:${issue.stepIndex}:${issue.round}:${issue.needsYou?.reason ?? ''}`
}

/** Tracker-linked issues whose position changed between two states. */
export function trackerMovesBetween(
  previous: AgentTeamState,
  next: AgentTeamState,
  now: number,
  newId: () => string
): AgentTeamTrackerEvent[] {
  const before = new Map(previous.issues.map((issue) => [issue.id, positionKey(issue)]))
  return next.issues.flatMap((issue) => {
    if (!issue.tracker || before.get(issue.id) === positionKey(issue)) {
      return []
    }
    return [
      {
        id: newId(),
        issueId: issue.id,
        repoId: issue.repoId,
        key: issue.tracker.key,
        title: issue.title,
        position: describeIssuePosition(issue, next),
        at: now
      }
    ]
  })
}

/** Keeps only the latest move per issue, capped so an absent Manager cannot grow the file forever. */
export function mergeTrackerEvents(
  pending: AgentTeamTrackerEvent[],
  added: AgentTeamTrackerEvent[]
): AgentTeamTrackerEvent[] {
  const latest = new Map<string, AgentTeamTrackerEvent>()
  for (const event of [...pending, ...added]) {
    latest.delete(event.issueId)
    latest.set(event.issueId, event)
  }
  return [...latest.values()].slice(-MAX_PENDING_EVENTS)
}

/** One message asking the Manager to bring the trackers in line with these moves. */
export function composeTrackerSyncMessage(
  events: AgentTeamTrackerEvent[],
  projectName: (repoId: string) => string
): string {
  return [
    'Orca team update: these tracker-linked issues moved. Update each one in its tracker following that project spec (labels or states for its new position). Do not create issues or change anything else, then reply with one line per issue saying what you changed.',
    ...events.map(
      (event) =>
        `- ${projectName(event.repoId)} ${event.key} "${event.title}": now ${event.position}`
    )
  ].join('\n')
}
