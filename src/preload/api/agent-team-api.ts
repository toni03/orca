import type { AgentTeamCommand } from '../../shared/agent-team/agent-team-commands'
import type { AgentTeamState } from '../../shared/agent-team/agent-team-types'

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
  onChanged: (callback: (state: AgentTeamState) => void) => () => void
}
