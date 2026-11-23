import type { AgentTeamCommand } from '../../../shared/agent-team/agent-team-commands'
import type { AgentTeamState } from '../../../shared/agent-team/agent-team-types'
import type { AgentTeamIssueLiveStatus } from '../../../shared/agent-team/agent-team-ipc'
import type { AgentTeamManagerScope } from '../../../shared/agent-team/agent-team-manager-bots'
import type { Bot } from '../../../shared/bot-types'

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
  /** Creates the Manager bot of the current scope; `teamId` with one Manager per team. */
  createManagerBot: (args: { agent: Bot['agent']; teamId?: string }) => Promise<Bot>
  setManagerScope: (scope: AgentTeamManagerScope) => Promise<AgentTeamState>
  /** Labels and state from the tracker, and the branch's pull request, read on demand. */
  issueLiveStatus: (issueId: string) => Promise<AgentTeamIssueLiveStatus>
  onChanged: (callback: (state: AgentTeamState) => void) => () => void
}
