import type { TuiAgent } from '../agent-launch/catalog/tui-agent'

export const AGENT_TEAM_CHANNELS = {
  getState: 'agentTeam:getState',
  execute: 'agentTeam:execute',
  readProjectSpec: 'agentTeam:readProjectSpec',
  writeProjectSpec: 'agentTeam:writeProjectSpec',
  launchManager: 'agentTeam:launchManager',
  managerSession: 'agentTeam:managerSession',
  managerActivity: 'agentTeam:managerActivity',
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
