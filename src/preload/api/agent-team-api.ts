import type { AgentTeamCommand } from '../../shared/agent-team/agent-team-commands'
import type { AgentTeamState } from '../../shared/agent-team/agent-team-types'
import type { TuiAgent } from '../../shared/tui-agent'

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
  launchManager: (args: {
    agent: TuiAgent
    request: string
  }) => Promise<{ worktreeId: string; terminalHandle: string }>
  onChanged: (callback: (state: AgentTeamState) => void) => () => void
}
