import type { CheckStatus, PRReviewDecision } from '../github/pull-requests/pull-request-types'
import type {
  HostedReviewProvider,
  HostedReviewState
} from '../source-control/hosted-review/hosted-review-contracts'

export const AGENT_TEAM_CHANNELS = {
  getState: 'agentTeam:getState',
  execute: 'agentTeam:execute',
  readProjectSpec: 'agentTeam:readProjectSpec',
  writeProjectSpec: 'agentTeam:writeProjectSpec',
  createManagerBot: 'agentTeam:createManagerBot',
  setManagerScope: 'agentTeam:setManagerScope',
  issueLiveStatus: 'agentTeam:issueLiveStatus',
  changed: 'agentTeam:changed'
} as const

/** The tracker issue and the branch's pull request as their services report them now. */
export type AgentTeamIssueLiveStatus = {
  tracker: { state: string; open: boolean; labels: string[] } | null
  review: {
    provider: HostedReviewProvider
    number: number
    url: string
    state: HostedReviewState
    checks: CheckStatus
    reviewDecision?: PRReviewDecision
  } | null
  /** Reviews of a grouped issue's other repos, one per linked worktree that has one. */
  linkedReviews?: {
    repoId: string
    review: NonNullable<AgentTeamIssueLiveStatus['review']>
  }[]
}
