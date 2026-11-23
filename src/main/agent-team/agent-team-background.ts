// The team's background work beside the engine tick: usage, tracker moves, Needs you items, Manager
// bots, plan limits and phone alerts. Each returns its own stop.
import type { AgentTeamUserDecision } from '../../shared/agent-team/agent-team-pipeline'
import { getRepoRoutingConnectionId } from '../../shared/execution-host/execution-host'
import type { Store } from '../persistence/loading-store/store'
import type { RateLimitService } from '../rate-limits/service/rate-limit-service'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { resolveAgentTeamCliCommand } from './agent-team-cli-command'
import { syncAgentTeamManagerBots } from './agent-team-manager-bot'
import { startAgentTeamMobileAlerts } from './agent-team-mobile-alerts'
import { AgentTeamNeedsYouItems } from './agent-team-needs-you-items'
import { watchAgentTeamPlanLimits } from './agent-team-plan-limit-watch'
import type { AgentTeamStore } from './agent-team-store'
import type { AgentTeamTrackerSync } from './agent-team-tracker-sync'
import {
  startAgentTeamUsageCollector,
  type AgentTeamUsageSources
} from './agent-team-usage-collector'

export function startAgentTeamBackground(deps: {
  store: AgentTeamStore
  runtime: OrcaRuntimeService
  repos: Store
  usage: AgentTeamUsageSources
  planLimits: RateLimitService | null
  trackerSync: AgentTeamTrackerSync
  decide: (issueId: string, decision: AgentTeamUserDecision) => void
  tick: () => void
}): (() => void)[] {
  const { store, runtime, repos } = deps
  void syncAgentTeamManagerBots(runtime, store, resolveAgentTeamCliCommand()).catch(
    (error: unknown) => console.warn('[agent-team] Could not check the Manager bots:', error)
  )
  return [
    startAgentTeamUsageCollector(
      store,
      (repoId) => {
        const repo = repos.getRepo(repoId)
        return repo ? getRepoRoutingConnectionId(repo) !== null : false
      },
      deps.usage
    ),
    deps.trackerSync.start(),
    new AgentTeamNeedsYouItems({ store, runtime, decide: deps.decide }).start(),
    watchAgentTeamPlanLimits(deps.planLimits, store, deps.tick),
    startAgentTeamMobileAlerts({
      getState: () => store.get(),
      subscribe: (listener) => store.subscribe(listener),
      projectName: (repoId) => repos.getRepo(repoId)?.displayName ?? repoId,
      dispatch: (event) => runtime.dispatchMobileNotification(event)
    })
  ]
}
