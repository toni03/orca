import type { AgentTeamState } from './agent-team-types'

/** One Manager bot for every team, or one per team: the user picks which they talk to. */
export type AgentTeamManagerScope = 'shared' | 'per-team'

/** Orca bot ids by what they manage. */
export type AgentTeamManagerBots = {
  shared?: string
  /** By team id. */
  teams?: Record<string, string>
}

export function managerScopeOf(state: Pick<AgentTeamState, 'managerScope'>): AgentTeamManagerScope {
  return state.managerScope ?? 'shared'
}

/** The bot that manages `teamId`, or null when that Manager was never created. */
export function managerBotIdFor(
  state: Pick<AgentTeamState, 'managerScope' | 'managerBots'>,
  teamId: string | null
): string | null {
  const bots = state.managerBots ?? {}
  if (managerScopeOf(state) === 'shared' || teamId === null) {
    return bots.shared ?? null
  }
  return bots.teams?.[teamId] ?? null
}

/** Every Manager bot the current scope uses, each with the teams it manages. */
export function activeManagerBots(
  state: Pick<AgentTeamState, 'managerScope' | 'managerBots' | 'teams'>
): { botId: string; teamIds: string[] }[] {
  if (managerScopeOf(state) === 'shared') {
    const shared = state.managerBots?.shared
    return shared ? [{ botId: shared, teamIds: state.teams.map((team) => team.id) }] : []
  }
  return state.teams.flatMap((team) => {
    const botId = state.managerBots?.teams?.[team.id]
    return botId ? [{ botId, teamIds: [team.id] }] : []
  })
}

/** Drops ids of bots that no longer exist, so a deleted bot can be created again. */
export function pruneManagerBots(
  bots: AgentTeamManagerBots | undefined,
  exists: (botId: string) => boolean
): AgentTeamManagerBots | undefined {
  if (!bots) {
    return bots
  }
  const teams = Object.fromEntries(
    Object.entries(bots.teams ?? {}).filter(([, botId]) => exists(botId))
  )
  return {
    ...(bots.shared && exists(bots.shared) ? { shared: bots.shared } : {}),
    ...(Object.keys(teams).length > 0 ? { teams } : {})
  }
}
