import { createAgentTeamService } from '../../agent-team/agent-team-service'
import { registerAgentTeamHandlers } from '../../ipc/agent-team'
import { setAgentTeamService } from '../../agent-team/agent-team-service-registry'
import type { DesktopCore } from '../../core-desktop/desktop-core'
import type { Store } from '../../persistence/loading-store/store'

/** Desktop only: a headless serve host has no Team view to answer Needs you items. */
export function initializeMainProcessAgentTeam(
  core: DesktopCore,
  store: Store,
  isServeMode: boolean
): void {
  const runtime = core.runtime
  if (!runtime || isServeMode) {
    return
  }
  const service = createAgentTeamService(
    runtime,
    store,
    {
      claude: () => core.claudeUsage,
      codex: () => core.codexUsage
    },
    () => core.rateLimits
  )
  setAgentTeamService(service)
  const unregister = registerAgentTeamHandlers(service)
  service.start()
  core.stopAgentTeam = () => {
    unregister()
    setAgentTeamService(null)
    service.stop()
  }
}
