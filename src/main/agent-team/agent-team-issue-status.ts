import type { AgentTeamIssueLiveStatus } from '../../shared/agent-team/agent-team-ipc'
import type { AgentTeamIssue } from '../../shared/agent-team/agent-team-types'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'

type TrackerStatus = NonNullable<AgentTeamIssueLiveStatus['tracker']>
type ReviewStatus = NonNullable<AgentTeamIssueLiveStatus['review']>

function issueNumber(key: string): number | null {
  const match = /(\d+)\s*$/.exec(key)
  return match ? Number(match[1]) : null
}

async function readTrackerStatus(
  runtime: OrcaRuntimeService,
  issue: AgentTeamIssue
): Promise<TrackerStatus | null> {
  const tracker = issue.tracker
  if (!tracker) {
    return null
  }
  const repoSelector = `id:${issue.repoId}`
  switch (tracker.provider) {
    case 'github': {
      const number = issueNumber(tracker.key)
      const item = number ? await runtime.getRepoWorkItem(repoSelector, number, 'issue') : null
      return item ? { state: item.state, open: item.state === 'open', labels: item.labels } : null
    }
    case 'gitlab': {
      const iid = issueNumber(tracker.key)
      const details = iid
        ? await runtime.getGitLabRepoWorkItemDetails(repoSelector, iid, 'issue')
        : null
      return details
        ? {
            state: details.item.state,
            open: details.item.state === 'opened',
            labels: details.item.labels
          }
        : null
    }
    case 'jira': {
      const jira = await runtime.jiraGetIssue(tracker.key)
      return jira
        ? {
            state: jira.status.name,
            open: jira.status.categoryKey !== 'done',
            labels: jira.labels
          }
        : null
    }
    case 'linear': {
      const linear = await runtime.linearGetIssue(tracker.key)
      return linear
        ? {
            state: linear.state.name,
            open: linear.state.type !== 'completed' && linear.state.type !== 'canceled',
            labels: linear.labels
          }
        : null
    }
  }
}

async function readReviewStatus(
  runtime: OrcaRuntimeService,
  repoId: string,
  branch: string | undefined
): Promise<ReviewStatus | null> {
  if (!branch) {
    return null
  }
  const reply = await runtime.getHostedReviewForBranch({
    repoSelector: `id:${repoId}`,
    branch
  })
  const review = reply && 'readOutcome' in reply ? reply.review : reply
  return review
    ? {
        provider: review.provider,
        number: review.number,
        url: review.url,
        state: review.state,
        checks: review.status,
        ...(review.reviewDecision ? { reviewDecision: review.reviewDecision } : {})
      }
    : null
}

/** What the tracker and the code host say about an issue right now; each side may be unavailable. */
export async function readAgentTeamIssueLiveStatus(
  runtime: OrcaRuntimeService,
  issue: AgentTeamIssue
): Promise<AgentTeamIssueLiveStatus> {
  const [tracker, review, linked] = await Promise.all([
    readTrackerStatus(runtime, issue).catch(() => null),
    readReviewStatus(runtime, issue.repoId, issue.branch).catch(() => null),
    Promise.all(
      (issue.linkedWorktrees ?? []).map(async (entry) => ({
        repoId: entry.repoId,
        review: await readReviewStatus(runtime, entry.repoId, entry.branch).catch(() => null)
      }))
    )
  ])
  const linkedReviews = linked.flatMap((entry) =>
    entry.review ? [{ repoId: entry.repoId, review: entry.review }] : []
  )
  return { tracker, review, ...(linkedReviews.length > 0 ? { linkedReviews } : {}) }
}
