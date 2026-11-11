import { AgentTeamMutationError } from './agent-team-mutations'
import type { AgentTeamProjectGroup, AgentTeamState } from './agent-team-types'

export function projectGroupOfRepo(
  state: Pick<AgentTeamState, 'groups'>,
  repoId: string
): AgentTeamProjectGroup | undefined {
  return state.groups?.find((group) => group.repoIds.includes(repoId))
}

/** Issues of a grouped repo belong to the group's tracker repo, where its config lives. */
export function teamProjectRepoId(state: Pick<AgentTeamState, 'groups'>, repoId: string): string {
  return projectGroupOfRepo(state, repoId)?.trackerRepoId ?? repoId
}

/** The other repos of an issue's group, which get linked worktrees. */
export function linkedRepoIds(state: Pick<AgentTeamState, 'groups'>, repoId: string): string[] {
  const group = projectGroupOfRepo(state, repoId)
  return group ? group.repoIds.filter((id) => id !== group.trackerRepoId) : []
}

export function setProjectGroup(
  state: AgentTeamState,
  group: AgentTeamProjectGroup
): AgentTeamState {
  const repoIds = [...new Set(group.repoIds)]
  if (!repoIds.includes(group.trackerRepoId)) {
    throw new AgentTeamMutationError('The tracker repo must be one of the group repos.')
  }
  const taken = (state.groups ?? []).find(
    (other) =>
      other.groupId !== group.groupId && other.repoIds.some((repoId) => repoIds.includes(repoId))
  )
  if (taken) {
    throw new AgentTeamMutationError('A repo can belong to only one team project group.')
  }
  const previous = state.groups?.find((other) => other.groupId === group.groupId)
  const active = state.issues.some(
    (issue) =>
      issue.repoId === previous?.trackerRepoId &&
      (issue.status === 'working' || issue.status === 'needs-you')
  )
  if (previous && active && previous.trackerRepoId !== group.trackerRepoId) {
    throw new AgentTeamMutationError(
      'Finish or discard the group issues in progress before changing its tracker repo.'
    )
  }
  const next = { groupId: group.groupId, trackerRepoId: group.trackerRepoId, repoIds }
  const others = (state.groups ?? []).filter((other) => other.groupId !== group.groupId)
  // Waiting issues of the group move with it; issues in progress were refused above.
  const moved = new Set(repoIds)
  const issues = state.issues.map((issue) =>
    moved.has(issue.repoId) && (issue.status === 'registered' || issue.status === 'queued')
      ? { ...issue, repoId: group.trackerRepoId }
      : issue
  )
  return { ...state, issues, groups: [...others, next] }
}

export function removeProjectGroup(state: AgentTeamState, groupId: string): AgentTeamState {
  return { ...state, groups: (state.groups ?? []).filter((group) => group.groupId !== groupId) }
}
