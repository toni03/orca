import type { TuiAgent } from '../agent-launch/catalog/tui-agent'
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
  launchManager: 'agentTeam:launchManager',
  managerSession: 'agentTeam:managerSession',
  managerActivity: 'agentTeam:managerActivity',
  issueLiveStatus: 'agentTeam:issueLiveStatus',
  changed: 'agentTeam:changed'
} as const

/** The Manager's terminal, enough for the Team page to show it as a chat. */
export type AgentTeamManagerSession = {
  worktreeId: string
  terminalHandle: string
  tabId: string | null
  paneKey: string | null
  ptyId: string | null
  agent: TuiAgent
}

/** Tokens and session time the Manager used in a range, read from local agent transcripts. */
export type AgentTeamManagerActivity = { tokens: number; activeMs: number }

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
