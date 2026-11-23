import { randomUUID } from 'node:crypto'
import {
  composeTrackerSyncMessage,
  mergeTrackerEvents,
  trackerMovesBetween
} from '../../shared/agent-team/agent-team-tracker-moves'
import type {
  AgentTeamState,
  AgentTeamTrackerEvent
} from '../../shared/agent-team/agent-team-types'
import type { Store } from '../persistence/loading-store/store'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { activeManagerBots } from '../../shared/agent-team/agent-team-manager-bots'
import { messageAgentTeamManagerBot } from './agent-team-manager-bot'
import type { AgentTeamStore } from './agent-team-store'

const DELIVERY_INTERVAL_MS = 30_000

function syncEnabled(state: AgentTeamState): boolean {
  return state.workflow.syncTracker !== false
}

/** Records tracker-linked moves and hands each Manager bot the moves of its teams' issues. */
export class AgentTeamTrackerSync {
  private delivering = false

  constructor(
    private readonly store: AgentTeamStore,
    private readonly runtime: OrcaRuntimeService,
    private readonly repos: Store
  ) {}

  start(): () => void {
    let previous = this.store.get()
    const unsubscribe = this.store.subscribe((next) => {
      const before = previous
      previous = next
      if (!syncEnabled(next)) {
        return
      }
      const moves = trackerMovesBetween(before, next, Date.now(), randomUUID)
      if (moves.length > 0) {
        // Deferred: a nested update would reach later listeners before the state that caused it.
        queueMicrotask(() => {
          this.store.update((current) => ({
            ...current,
            trackerEvents: mergeTrackerEvents(current.trackerEvents ?? [], moves)
          }))
          void this.deliver()
        })
      }
    })
    const timer = setInterval(() => void this.deliver(), DELIVERY_INTERVAL_MS)
    timer.unref?.()
    return () => {
      unsubscribe()
      clearInterval(timer)
    }
  }

  private async deliver(): Promise<void> {
    const state = this.store.get()
    const events = state.trackerEvents ?? []
    if (this.delivering || events.length === 0 || !syncEnabled(state)) {
      return
    }
    this.delivering = true
    try {
      const teamOf = new Map(state.issues.map((issue) => [issue.id, issue.teamId]))
      for (const manager of activeManagerBots(state)) {
        const mine = events.filter((event) =>
          manager.teamIds.includes(teamOf.get(event.issueId) ?? '')
        )
        if (mine.length === 0) {
          continue
        }
        // A bot that is mid-turn gets the message queued as its next turn.
        await messageAgentTeamManagerBot(this.runtime, manager.botId, this.message(mine))
        this.clear(mine)
      }
    } catch (error) {
      console.warn('[agent-team] Could not send tracker updates to the Manager:', error)
    } finally {
      this.delivering = false
    }
  }

  private clear(sent: AgentTeamTrackerEvent[]): void {
    const sentIds = new Set(sent.map((event) => event.id))
    this.store.update((current) => ({
      ...current,
      trackerEvents: (current.trackerEvents ?? []).filter((event) => !sentIds.has(event.id)),
      trackerSyncedAt: Date.now()
    }))
  }

  private message(events: AgentTeamTrackerEvent[]): string {
    return composeTrackerSyncMessage(
      events,
      (repoId) => this.repos.getRepo(repoId)?.displayName ?? repoId
    )
  }
}
