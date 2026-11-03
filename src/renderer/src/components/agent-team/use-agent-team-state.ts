import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import type { AgentTeamCommand } from '../../../../shared/agent-team/agent-team-commands'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'

/** Loads the team state once and follows main-process changes while the Team page is open. */
export function useAgentTeamState(): { state: AgentTeamState | null; loadError: string | null } {
  const state = useAppStore((s) => s.agentTeam)
  const loadError = useAppStore((s) => s.agentTeamLoadError)
  const loadAgentTeam = useAppStore((s) => s.loadAgentTeam)
  const setAgentTeam = useAppStore((s) => s.setAgentTeam)
  useEffect(() => {
    void loadAgentTeam()
    return window.api.agentTeam.onChanged(setAgentTeam)
  }, [loadAgentTeam, setAgentTeam])
  return { state, loadError }
}

/** Runs a command and reports a refusal as a toast; resolves null when it failed. */
export function useAgentTeamCommand(): (
  command: AgentTeamCommand
) => Promise<AgentTeamState | null> {
  const runAgentTeamCommand = useAppStore((s) => s.runAgentTeamCommand)
  return useCallback(
    async (command) => {
      try {
        return await runAgentTeamCommand(command)
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
            : String(error)
        )
        return null
      }
    },
    [runAgentTeamCommand]
  )
}
