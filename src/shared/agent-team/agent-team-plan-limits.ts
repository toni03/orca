import type { ProviderRateLimits, RateLimitState, RateLimitWindow } from '../rate-limit-types'
import type { TuiAgent } from '../tui-agent'
import type { AgentTeamLimitPause, AgentTeamState } from './agent-team-types'

const FULL_PERCENT = 100
const LIMIT_PAUSES_KEPT = 100

function providerFor(agent: TuiAgent, limits: RateLimitState): ProviderRateLimits | null {
  // Orca reads plan windows only for these CLIs.
  if (agent === 'claude') {
    return limits.claude
  }
  if (agent === 'codex') {
    return limits.codex
  }
  return agent === 'gemini' ? limits.gemini : null
}

function full(window: RateLimitWindow | null | undefined): boolean {
  return (window?.usedPercent ?? 0) >= FULL_PERCENT
}

/** Plan windows of an agent CLI as Orca reads them; null when Orca has no reader for it. */
export function agentPlanWindows(
  agent: TuiAgent,
  limits: RateLimitState
): { session: RateLimitWindow | null; weekly: RateLimitWindow | null } | null {
  const provider = providerFor(agent, limits)
  return provider ? { session: provider.session, weekly: provider.weekly } : null
}

/** Agent CLIs whose 5-hour or weekly window is used up, with when the first one resets. */
export function agentsAtPlanLimit(
  agents: Iterable<TuiAgent>,
  limits: RateLimitState
): Map<TuiAgent, number | null> {
  const atLimit = new Map<TuiAgent, number | null>()
  for (const agent of new Set(agents)) {
    const windows = agentPlanWindows(agent, limits)
    if (!windows) {
      continue
    }
    const used = [windows.session, windows.weekly].filter(full)
    if (used.length > 0) {
      const resets = used.flatMap((window) => (window?.resetsAt ? [window.resetsAt] : []))
      atLimit.set(agent, resets.length > 0 ? Math.max(...resets) : null)
    }
  }
  return atLimit
}

/** Opens a pause for agents that just hit their limit and closes the ones that recovered. */
export function updateLimitPauses(
  state: AgentTeamState,
  atLimit: ReadonlyMap<TuiAgent, number | null>,
  now: number
): AgentTeamState {
  const pauses = state.limitPauses ?? []
  const open = new Map(
    pauses.filter((pause) => pause.endedAt === undefined).map((pause) => [pause.agent, pause])
  )
  const seatAgents = new Set(
    state.seats.filter((seat) => seat.retiredAt === undefined).map((seat) => seat.agent)
  )
  let changed = false
  const next: AgentTeamLimitPause[] = pauses.map((pause) => {
    if (pause.endedAt === undefined && !atLimit.has(pause.agent)) {
      changed = true
      return { ...pause, endedAt: now }
    }
    return pause
  })
  for (const [agent, resetsAt] of atLimit) {
    if (!open.has(agent) && seatAgents.has(agent)) {
      changed = true
      next.push({ agent, startedAt: now, ...(resetsAt ? { resetsAt } : {}) })
    }
  }
  return changed ? { ...state, limitPauses: next.slice(-LIMIT_PAUSES_KEPT) } : state
}

/** Agent CLIs that are out of plan right now, as recorded in the team state. */
export function agentsOnLimitPause(state: AgentTeamState): ReadonlySet<string> {
  return new Set(
    (state.limitPauses ?? [])
      .filter((pause) => pause.endedAt === undefined)
      .map((pause) => pause.agent)
  )
}
