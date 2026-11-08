import { findOpenAssignment, stepRole } from '../../shared/agent-team/agent-team-pipeline'
import type { AgentTeamState, AgentTeamStepResult } from '../../shared/agent-team/agent-team-types'
import type { AgentTeamLauncher } from './agent-team-launcher'

/**
 * A Build session that stopped without reporting may still have delivered. A merge or pull
 * request on its branch, opened or updated while this session ran, stands in for its report.
 */
export async function recoverUnreportedBuild(
  launcher: AgentTeamLauncher,
  state: AgentTeamState,
  assignmentId: string
): Promise<AgentTeamStepResult | null> {
  const found = findOpenAssignment(state.issues, (candidate) => candidate.id === assignmentId)
  const team = state.teams.find((candidate) => candidate.id === found?.issue.teamId)
  if (!found || !team) {
    return null
  }
  const { issue, assignment } = found
  if (!issue.branch || launcher.isFolderProject(issue.repoId)) {
    return null
  }
  if (stepRole(team, issue.stepIndex, state.roles)?.stepType !== 'build') {
    return null
  }
  const review = await launcher.findMergeRequest(issue.repoId, issue.branch).catch(() => null)
  if (!review || (review.state !== 'open' && review.state !== 'draft')) {
    return null
  }
  // A review left over from an earlier round proves nothing about this one.
  const updatedAt = Date.parse(review.updatedAt)
  if (issue.mergeRequest && !(updatedAt >= assignment.startedAt)) {
    return null
  }
  return {
    kind: 'done',
    summary: `The session stopped without reporting. Orca found ${review.url} on ${issue.branch} and took it as this step's result.`,
    mergeRequestUrl: review.url
  }
}
