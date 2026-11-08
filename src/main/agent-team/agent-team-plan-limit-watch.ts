import {
  agentsAtPlanLimit,
  updateLimitPauses
} from '../../shared/agent-team/agent-team-plan-limits'
import type { RateLimitState } from '../../shared/rate-limit-types'
import type { RateLimitService } from '../rate-limits/service'
import type { AgentTeamStore } from './agent-team-store'

/** Seats of an agent CLI that ran out of plan wait for its window instead of failing a step. */
export function watchAgentTeamPlanLimits(
  limits: Pick<RateLimitService, 'getState' | 'onStateChange'> | null,
  store: Pick<AgentTeamStore, 'update'>,
  onChange: () => void
): () => void {
  if (!limits) {
    return () => undefined
  }
  const apply = (rateLimits: RateLimitState): void => {
    store.update((current) =>
      updateLimitPauses(
        current,
        agentsAtPlanLimit(
          current.seats.map((seat) => seat.agent),
          rateLimits
        ),
        Date.now()
      )
    )
    onChange()
  }
  apply(limits.getState())
  return limits.onStateChange(apply)
}
