import type { AgentTeamCommand } from '../../shared/agent-team/agent-team-commands'
import type { AgentTeamState } from '../../shared/agent-team/agent-team-types'
import type { TuiAgent } from '../../shared/tui-agent'
import type { AgentTeamManagerSession } from '../../shared/agent-team/agent-team-ipc'

export type AgentTeamProjectSpecRead = {
  storage: 'repository' | 'local'
  text: string
  path: string | null
}

export type AgentTeamApi = {
  getState: () => Promise<AgentTeamState | null>
  execute: (command: AgentTeamCommand) => Promise<AgentTeamState>
  readProjectSpec: (repoId: string) => Promise<AgentTeamProjectSpecRead>
  writeProjectSpec: (repoId: string, text: string) => Promise<void>
  launchManager: (args: { agent: TuiAgent; request: string }) => Promise<AgentTeamManagerSession>
  /** The live Manager session, if one is open. */
  managerSession: () => Promise<AgentTeamManagerSession | null>
  onChanged: (callback: (state: AgentTeamState) => void) => () => void
}
