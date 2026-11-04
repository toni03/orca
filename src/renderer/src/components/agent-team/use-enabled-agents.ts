import { useAppStore } from '@/store'
import { getAgentCatalog } from '@/lib/agent-catalog'
import { isTuiAgentEnabled } from '../../../../shared/tui-agent-selection'
import type { TuiAgent } from '../../../../shared/tui-agent'

/** Agent CLIs switched on in Settings › Agents, plus the preferred one to preselect. */
export function useEnabledAgents(): {
  agents: ReturnType<typeof getAgentCatalog>
  preferred: TuiAgent | null
} {
  const settings = useAppStore((s) => s.settings)
  const agents = getAgentCatalog().filter((entry) =>
    isTuiAgentEnabled(entry.id, settings?.disabledTuiAgents)
  )
  const fallback = settings?.defaultTuiAgent
  const preferred =
    agents.find((entry) => entry.id === fallback)?.id ??
    agents.find((entry) => entry.id === 'claude')?.id ??
    agents[0]?.id ??
    null
  return { agents, preferred }
}
