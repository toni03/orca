// The Manager is an Orca bot: made here with the orca-team skill, then talked to like any bot.
import { join } from 'node:path'
import type { Bot } from '../../shared/bot-types'
import { botFirstKickoff } from '../../shared/bots/bot-import'
import { BOT_OWN_SKILLS_FOLDER } from '../../shared/bots/bot-package'
import {
  AGENT_TEAM_MANAGER_SKILL,
  composeAgentTeamManagerSkill
} from '../../shared/agent-team/agent-team-manager-prompt'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { runtimeBotChats } from '../bots/bot-chat-session'
import { applyBotPackage } from '../bots/bot-package-apply'
import { botHomeFolder } from '../bots/bot-home'
import { botShareCreateDeps } from '../runtime/rpc/methods/bots-share-create-deps'
import { managerScopeOf, pruneManagerBots } from '../../shared/agent-team/agent-team-manager-bots'
import type { AgentTeamStore } from './agent-team-store'

export type AgentTeamManagerBotInput = {
  agent: Bot['agent']
  /** The team it manages alone; absent for the Manager of every team. */
  team?: { id: string; name: string }
  cliCommand: string | null
}

function managerPurpose(team: AgentTeamManagerBotInput['team']): string {
  return team
    ? `Manages the ${team.name} agent team in Orca (team id ${team.id}): only that team's issues, seats and steps.`
    : "Manages the user's agent teams in Orca: issues, seats, steps and what waits for the user."
}

/** Creates the Manager bot with its skill and sends its first turn, as New bot does. */
export async function createAgentTeamManagerBot(
  runtime: OrcaRuntimeService,
  input: AgentTeamManagerBotInput
): Promise<Bot> {
  runtime.bots.assertEnabled()
  const created = await runtime.bots.create({
    name: input.team ? `${input.team.name} Manager` : 'Team Manager',
    agent: input.agent,
    seed: {
      purpose: managerPurpose(input.team),
      does: 'Turns requests into tracker issues, queues them for the seats, unblocks them and reports progress.',
      reports: 'Here, when you ask and when tracker-linked issues move'
    }
  })
  const bot = await applyBotPackage(botShareCreateDeps(runtime), created, {
    files: [
      {
        to: `${BOT_OWN_SKILLS_FOLDER}/${AGENT_TEAM_MANAGER_SKILL}/SKILL.md`,
        text: composeAgentTeamManagerSkill(input.cliCommand)
      }
    ],
    tools: [],
    schedules: [],
    setup: {
      template: 'Agent team Manager',
      firstSteps:
        'Uses its orca-team skill: reads `orca team context --json` and asks what the team should work on.',
      connectors: [],
      toolsToSignIn: [],
      schedulesOff: [],
      eventsSuggested: []
    }
  })
  runtimeBotChats(runtime)
    .sendToChat(bot.id, botFirstKickoff(bot), 'bot-created')
    .catch((error: unknown) => console.warn('[agent-team] Manager first turn failed:', error))
  return bot
}

/** Rewrites the skill of existing Manager bots, so they follow this build's CLI. */
export async function refreshAgentTeamManagerSkill(
  runtime: OrcaRuntimeService,
  botIds: readonly string[],
  cliCommand: string | null
): Promise<void> {
  const deps = botShareCreateDeps(runtime)
  const text = composeAgentTeamManagerSkill(cliCommand)
  for (const bot of runtime.bots.list().filter((entry) => botIds.includes(entry.id))) {
    const folder = join(
      botHomeFolder(bot, deps.botsRoot()),
      BOT_OWN_SKILLS_FOLDER,
      AGENT_TEAM_MANAGER_SKILL
    )
    await deps.filesystem.makeDirectory(folder)
    const path = join(folder, 'SKILL.md')
    if ((await deps.filesystem.readText(path)) !== text) {
      await deps.filesystem.writeText(path, text)
    }
  }
}

/** Sends `text` to the bot's chat as a message from Orca; it wakes the bot if it is idle. */
export async function messageAgentTeamManagerBot(
  runtime: OrcaRuntimeService,
  botId: string,
  text: string
): Promise<void> {
  await runtimeBotChats(runtime).sendToChat(botId, text)
}

type ManagerBotStore = Pick<AgentTeamStore, 'get' | 'update'>

/** Creates the Manager bot for the current scope (`teamId` with one per team) and records it. */
export async function addAgentTeamManagerBot(
  runtime: OrcaRuntimeService,
  store: ManagerBotStore,
  args: { agent: Bot['agent']; teamId?: string; cliCommand: string | null }
): Promise<Bot> {
  const state = store.get()
  const perTeam = managerScopeOf(state) === 'per-team'
  const team = perTeam ? state.teams.find((candidate) => candidate.id === args.teamId) : undefined
  if (perTeam && !team) {
    throw new Error('Pick the team this Manager runs.')
  }
  const bot = await createAgentTeamManagerBot(runtime, {
    agent: args.agent,
    cliCommand: args.cliCommand,
    ...(team ? { team: { id: team.id, name: team.name } } : {})
  })
  store.update((current) => {
    const bots = current.managerBots ?? {}
    return {
      ...current,
      managerBots: team
        ? { ...bots, teams: { ...bots.teams, [team.id]: bot.id } }
        : { ...bots, shared: bot.id }
    }
  })
  return bot
}

/** Forgets Manager bots the user deleted and keeps the others' skill current. */
export async function syncAgentTeamManagerBots(
  runtime: OrcaRuntimeService,
  store: ManagerBotStore,
  cliCommand: string | null
): Promise<void> {
  if (!runtime.bots.enabled()) {
    return
  }
  const existing = new Set(runtime.bots.list().map((bot) => bot.id))
  const pruned = pruneManagerBots(store.get().managerBots, (botId) => existing.has(botId))
  if (JSON.stringify(pruned) !== JSON.stringify(store.get().managerBots)) {
    store.update((current) => ({ ...current, managerBots: pruned }))
  }
  const ids = [pruned?.shared, ...Object.values(pruned?.teams ?? {})].filter(
    (id): id is string => typeof id === 'string'
  )
  await refreshAgentTeamManagerSkill(runtime, ids, cliCommand)
}
