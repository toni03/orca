import { ipcRenderer } from 'electron'
import { AGENT_TEAM_CHANNELS } from '../../shared/agent-team/agent-team-ipc'
import type { AgentTeamState } from '../../shared/agent-team/agent-team-types'
import type { PreloadApi } from '../api-types'

export const agentTeamApi = {
  getState: () => ipcRenderer.invoke(AGENT_TEAM_CHANNELS.getState),
  execute: (command) => ipcRenderer.invoke(AGENT_TEAM_CHANNELS.execute, command),
  readProjectSpec: (repoId) => ipcRenderer.invoke(AGENT_TEAM_CHANNELS.readProjectSpec, repoId),
  writeProjectSpec: (repoId, text) =>
    ipcRenderer.invoke(AGENT_TEAM_CHANNELS.writeProjectSpec, repoId, text),
  launchManager: (args) => ipcRenderer.invoke(AGENT_TEAM_CHANNELS.launchManager, args),
  managerSession: () => ipcRenderer.invoke(AGENT_TEAM_CHANNELS.managerSession),
  onChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AgentTeamState): void =>
      callback(state)
    ipcRenderer.on(AGENT_TEAM_CHANNELS.changed, listener)
    return () => {
      ipcRenderer.removeListener(AGENT_TEAM_CHANNELS.changed, listener)
    }
  }
} satisfies PreloadApi['agentTeam']
