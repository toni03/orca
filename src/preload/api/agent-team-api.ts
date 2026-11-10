import type { AgentTeamCommand } from '../../shared/agent-team/agent-team-commands'
import type { AgentTeamState } from '../../shared/agent-team/agent-team-types'
import type { TuiAgent } from '../../shared/agent-launch/catalog/tui-agent'
import type {
  AgentTeamIssueLiveStatus,
  AgentTeamManagerActivity,
  AgentTeamManagerSession
} from '../../shared/agent-team/agent-team-ipc'

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
  managerActivity: (from: number, to: number) => Promise<AgentTeamManagerActivity>
  /** Labels and state from the tracker, and the branch's pull request, read on demand. */
  issueLiveStatus: (issueId: string) => Promise<AgentTeamIssueLiveStatus>
  onChanged: (callback: (state: AgentTeamState) => void) => () => void
}
