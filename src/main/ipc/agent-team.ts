import { BrowserWindow, ipcMain } from 'electron'
import type { AgentTeamCommand } from '../../shared/agent-team/agent-team-commands'
import { AGENT_TEAM_CHANNELS } from '../../shared/agent-team/agent-team-ipc'
import type { AgentTeamState } from '../../shared/agent-team/agent-team-types'
import type { AgentTeamService } from '../agent-team/agent-team-service'

function broadcastAgentTeamState(state: AgentTeamState): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue
    }
    try {
      window.webContents.send(AGENT_TEAM_CHANNELS.changed, state)
    } catch {
      // A renderer can disappear between isDestroyed() and send().
    }
  }
}

export function registerAgentTeamHandlers(service: AgentTeamService): () => void {
  ipcMain.handle(AGENT_TEAM_CHANNELS.getState, () => service.getState())
  ipcMain.handle(AGENT_TEAM_CHANNELS.execute, (_event, command: AgentTeamCommand) =>
    service.execute(command)
  )
  ipcMain.handle(AGENT_TEAM_CHANNELS.readProjectSpec, (_event, repoId: string) =>
    service.readProjectSpec(repoId)
  )
  ipcMain.handle(AGENT_TEAM_CHANNELS.writeProjectSpec, (_event, repoId: string, text: string) =>
    service.writeProjectSpec(repoId, text)
  )
  const unsubscribe = service.subscribe(broadcastAgentTeamState)
  return () => {
    unsubscribe()
    for (const channel of [
      AGENT_TEAM_CHANNELS.getState,
      AGENT_TEAM_CHANNELS.execute,
      AGENT_TEAM_CHANNELS.readProjectSpec,
      AGENT_TEAM_CHANNELS.writeProjectSpec
    ]) {
      ipcMain.removeHandler(channel)
    }
  }
}
