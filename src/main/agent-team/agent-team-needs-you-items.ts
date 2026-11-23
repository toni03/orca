// Mirrors each Needs you issue as an item of its Manager bot, so the user answers it where they answer
// any bot (desktop or phone), and applies the reply to the team without going through the bot's turn.
import type { Bot } from '../../shared/bot-types'
import type { BotItemAsk } from '../../shared/bots/bot-item-ask'
import type { BotItemStatus } from '../../shared/bots/bot-items'
import { managerBotIdFor } from '../../shared/agent-team/agent-team-manager-bots'
import {
  needsYouAsk,
  needsYouItemTitle,
  needsYouReplyDecision
} from '../../shared/agent-team/agent-team-needs-you-ask'
import type { AgentTeamUserDecision } from '../../shared/agent-team/agent-team-pipeline'
import type {
  AgentTeamBotItemLink,
  AgentTeamIssue,
  AgentTeamIssueStatus,
  AgentTeamState
} from '../../shared/agent-team/agent-team-types'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type { BotItemBotActor } from '../bots/bot-items-input'
import type { AgentTeamStore } from './agent-team-store'

const SYNC_MS = 15_000
const EVENTS_PAGE = 50

type ItemsDeps = {
  store: Pick<AgentTeamStore, 'get' | 'update' | 'subscribe'>
  runtime: OrcaRuntimeService
  decide: (issueId: string, decision: AgentTeamUserDecision) => void
}

function itemStatusFor(status: AgentTeamIssueStatus): BotItemStatus {
  switch (status) {
    case 'needs-you':
      return 'needs_you'
    case 'done':
      return 'done'
    case 'discarded':
      return 'canceled'
    case 'registered':
      return 'planned'
    default:
      return 'working'
  }
}

function stepName(state: AgentTeamState, issue: AgentTeamIssue): string | null {
  const team = state.teams.find((candidate) => candidate.id === issue.teamId)
  return team?.steps[issue.stepIndex]?.name ?? null
}

export class AgentTeamNeedsYouItems {
  private running: Promise<void> | null = null
  private again = false

  constructor(private readonly deps: ItemsDeps) {}

  start(): () => void {
    const unsubscribe = this.deps.store.subscribe(() => this.schedule())
    const timer = setInterval(() => this.schedule(), SYNC_MS)
    timer.unref?.()
    this.schedule()
    return () => {
      unsubscribe()
      clearInterval(timer)
    }
  }

  private schedule(): void {
    if (this.running) {
      this.again = true
      return
    }
    this.running = this.sync()
      .catch((error: unknown) => console.warn('[agent-team] Needs you items sync failed:', error))
      .finally(() => {
        this.running = null
        if (this.again) {
          this.again = false
          this.schedule()
        }
      })
  }

  private async sync(): Promise<void> {
    const { runtime } = this.deps
    if (!runtime.bots.enabled()) {
      return
    }
    const bots = runtime.bots.list()
    for (const issue of this.deps.store.get().issues) {
      const state = this.deps.store.get()
      const current = state.issues.find((candidate) => candidate.id === issue.id)
      if (!current) {
        continue
      }
      const link = current.botItem
      if (current.status === 'needs-you' && current.needsYou) {
        const bot = bots.find((entry) => entry.id === managerBotIdFor(state, current.teamId))
        if (bot?.chatSessionId) {
          await this.ask(state, current, bot, link)
        }
      } else if (link && link.mirrored !== current.status) {
        await this.mirror(current, link, bots)
      }
    }
  }

  private actor(bot: Bot): BotItemBotActor {
    return {
      kind: 'bot',
      botId: bot.id,
      chatId: this.deps.runtime.botItems.chatRootOf(bot.chatSessionId!)
    }
  }

  private async ask(
    state: AgentTeamState,
    issue: AgentTeamIssue,
    bot: Bot,
    link: AgentTeamBotItemLink | undefined
  ): Promise<void> {
    const ask = needsYouAsk(issue, stepName(state, issue))
    if (!ask) {
      return
    }
    if (link && link.botId === bot.id && link.askedAt === issue.needsYou!.at) {
      await this.readReplies(issue, link, ask)
      return
    }
    const items = this.deps.runtime.botItems.store()
    const actor = this.actor(bot)
    let uid = link?.botId === bot.id ? link.uid : null
    if (!uid || !(await items.get(uid))) {
      const made = await items.add(
        {
          ownerBotId: bot.id,
          chatId: actor.chatId,
          source: this.deps.runtime.botItems.chatSource(
            bot,
            actor.chatId,
            (id) => this.deps.runtime.botItems.chatRootOf(id),
            null
          ),
          title: needsYouItemTitle(issue),
          description: issue.body.slice(0, 20_000),
          status: 'working',
          links: issue.mergeRequest ? [{ kind: 'url', ref: issue.mergeRequest.url }] : []
        },
        actor
      )
      uid = made.uid
    }
    const outcome = await items.set(uid, { status: 'needs_you', ask }, actor)
    await this.changed(uid)
    this.record(issue.id, {
      uid,
      botId: bot.id,
      askedAt: issue.needsYou!.at,
      seenEventId: outcome.eventId ?? 0,
      mirrored: 'needs-you'
    })
  }

  /** The owner's replies since the question; the first one the team can act on decides the issue. */
  private async readReplies(
    issue: AgentTeamIssue,
    link: AgentTeamBotItemLink,
    ask: BotItemAsk
  ): Promise<void> {
    const events = await this.deps.runtime.botItems
      .store()
      .events(link.uid, link.seenEventId, EVENTS_PAGE)
    if (events.length === 0) {
      return
    }
    let decision: AgentTeamUserDecision | null = null
    for (const event of events) {
      if (event.actor.kind !== 'owner') {
        continue
      }
      if (event.kind === 'commented') {
        decision = needsYouReplyDecision(issue, ask, event.data)
      } else if (event.kind === 'status' && event.data.to === 'done') {
        decision = { kind: 'done' }
      }
      if (decision) {
        break
      }
    }
    this.record(issue.id, { ...link, seenEventId: events.at(-1)!.id })
    if (decision) {
      this.deps.decide(issue.id, decision)
    }
  }

  /** Moves the item with the issue once it no longer waits: working again, held, done or discarded. */
  private async mirror(
    issue: AgentTeamIssue,
    link: AgentTeamBotItemLink,
    bots: readonly Bot[]
  ): Promise<void> {
    const bot = bots.find((entry) => entry.id === link.botId)
    const items = this.deps.runtime.botItems.store()
    const record = bot?.chatSessionId ? await items.get(link.uid) : null
    if (bot && record) {
      const actor = this.actor(bot)
      const to = itemStatusFor(issue.status)
      if (to === 'done' || to === 'canceled') {
        if (record.status !== to) {
          await items.close(
            link.uid,
            to,
            to === 'canceled' ? 'The issue was discarded from the team.' : undefined,
            actor
          )
        }
      } else if (record.status !== to) {
        await items.set(link.uid, { status: to }, actor)
      }
      await this.changed(link.uid)
    }
    this.record(issue.id, { ...link, mirrored: issue.status })
  }

  private async changed(uid: string): Promise<void> {
    const record = await this.deps.runtime.botItems.store().get(uid)
    if (record) {
      this.deps.runtime.botItems.changed([record])
    }
  }

  private record(issueId: string, link: AgentTeamBotItemLink): void {
    this.deps.store.update((state) => ({
      ...state,
      issues: state.issues.map((issue) =>
        issue.id === issueId ? { ...issue, botItem: link } : issue
      )
    }))
  }
}
