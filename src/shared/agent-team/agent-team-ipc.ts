import type { TuiAgent } from '../tui-agent'

export const AGENT_TEAM_CHANNELS = {
  getState: 'agentTeam:getState',
  execute: 'agentTeam:execute',
  readProjectSpec: 'agentTeam:readProjectSpec',
  writeProjectSpec: 'agentTeam:writeProjectSpec',
  launchManager: 'agentTeam:launchManager',
  managerSession: 'agentTeam:managerSession',
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
