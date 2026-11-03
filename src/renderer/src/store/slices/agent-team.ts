import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type { AgentTeamCommand } from '../../../../shared/agent-team/agent-team-commands'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'

export type AgentTeamSlice = {
  agentTeam: AgentTeamState | null
  agentTeamLoadError: string | null
  loadAgentTeam: () => Promise<void>
  /** Rejects with the main process's message so forms can show it inline. */
  runAgentTeamCommand: (command: AgentTeamCommand) => Promise<AgentTeamState>
  setAgentTeam: (state: AgentTeamState) => void
}

export const createAgentTeamSlice: StateCreator<AppState, [], [], AgentTeamSlice> = (set) => ({
  agentTeam: null,
  agentTeamLoadError: null,
  loadAgentTeam: async () => {
    try {
      const state = await window.api.agentTeam.getState()
      set({ agentTeam: state, agentTeamLoadError: null })
    } catch (error) {
      set({ agentTeamLoadError: error instanceof Error ? error.message : String(error) })
    }
  },
  runAgentTeamCommand: async (command) => {
    const state = await window.api.agentTeam.execute(command)
    set({ agentTeam: state })
    return state
  },
  setAgentTeam: (state) => set({ agentTeam: state })
})
