import { planAgentTeamAssignments, type AgentTeamWaitReason } from './agent-team-scheduler'
import type { AgentTeamIssue, AgentTeamState } from './agent-team-types'

/** Why a queued issue has not started, in plain English for the CLI and the Manager. */
export function describeWaitReason(reason: AgentTeamWaitReason, state: AgentTeamState): string {
  const keyOf = (issueId: string): string => {
    const issue = state.issues.find((candidate) => candidate.id === issueId)
    return issue?.tracker?.key ?? issueId.slice(0, 6)
  }
  switch (reason.kind) {
    case 'paused':
      return 'all teams paused'
    case 'team-paused':
      return 'team paused'
    case 'dependency':
      return `waiting for dependency ${keyOf(reason.issueId)}`
    case 'project-locked': {
      const team = state.teams.find((candidate) => candidate.id === reason.byTeamId)?.name ?? '?'
      const holds = reason.scope === 'team' ? 'holds its team' : 'locks the project'
      return `waiting for ${keyOf(reason.byIssueId)} (${team}), which ${holds}`
    }
    case 'no-free-seat':
      return 'no free seat'
    case 'seats-paused':
      return 'every seat of this step is paused'
    case 'plan-limit':
      return 'the seats of this step are out of plan until it resets'
    case 'no-seat':
      return 'this step has no seats'
    case 'missing-team':
      return 'its team or step was removed'
  }
}

/** The wait text of every queued issue that cannot start now, by issue id. */
export function describeWaiting(
  state: AgentTeamState,
  issues: readonly AgentTeamIssue[] = state.issues
): Record<string, string> {
  const { waiting } = planAgentTeamAssignments(state)
  return Object.fromEntries(
    issues.flatMap((issue) => {
      const reason = waiting[issue.id]
      return reason ? [[issue.id, describeWaitReason(reason, state)]] : []
    })
  )
}
