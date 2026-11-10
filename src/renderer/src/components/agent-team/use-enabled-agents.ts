import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { getAgentCatalog } from '@/lib/agent-catalog'
import { isTuiAgentEnabled } from '../../../../shared/agent-launch/catalog/tui-agent-selection'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'

/** Agent CLIs installed on this computer and switched on in Settings › Agents. */
export function useEnabledAgents(): {
  agents: ReturnType<typeof getAgentCatalog>
  preferred: TuiAgent | null
  detecting: boolean
} {
  const settings = useAppStore((s) => s.settings)
  const detectedIds = useAppStore((s) => s.detectedAgentIds)
  const ensureDetectedAgents = useAppStore((s) => s.ensureDetectedAgents)
  useEffect(() => {
    void ensureDetectedAgents().catch(() => undefined)
  }, [ensureDetectedAgents])

  const agents = getAgentCatalog().filter(
    (entry) =>
      detectedIds?.includes(entry.id) === true &&
      isTuiAgentEnabled(entry.id, settings?.disabledTuiAgents)
  )
  const fallback = settings?.defaultTuiAgent
  const preferred =
    agents.find((entry) => entry.id === fallback)?.id ??
    agents.find((entry) => entry.id === 'claude')?.id ??
    agents[0]?.id ??
    null
  return { agents, preferred, detecting: detectedIds === null }
}
