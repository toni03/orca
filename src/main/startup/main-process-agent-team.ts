import { createAgentTeamService } from '../agent-team/agent-team-service'
import { registerAgentTeamHandlers } from '../ipc/agent-team'
import { setAgentTeamService } from '../agent-team/agent-team-service-registry'
import { mainProcessState as state } from './main-process-state'

/** Desktop only: a headless serve host has no Team view to answer Needs you items. */
export function initializeMainProcessAgentTeam(): void {
  const store = state.store
  const runtime = state.runtime
  if (!store || !runtime || state.isServeMode) {
    return
  }
  const service = createAgentTeamService(runtime, store)
  setAgentTeamService(service)
  const unregister = registerAgentTeamHandlers(service)
  service.start()
  state.stopAgentTeam = () => {
    unregister()
    setAgentTeamService(null)
    service.stop()
  }
}
