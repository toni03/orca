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
import { findLiveManagerSession } from './agent-team-manager'
import { agentTeamManagerFolder } from './agent-team-manager-workspace'
import type { AgentTeamStore } from './agent-team-store'

const DELIVERY_INTERVAL_MS = 30_000

function syncEnabled(state: AgentTeamState): boolean {
  return state.workflow.syncTracker !== false
}

/** Records tracker-linked moves and hands them to an idle Manager session. */
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

  /** Pending moves as one message, for the first prompt of a new Manager session. */
  peekPending(): { message: string; events: AgentTeamTrackerEvent[] } | undefined {
    const events = this.store.get().trackerEvents ?? []
    if (events.length === 0 || !syncEnabled(this.store.get())) {
      return undefined
    }
    return { message: this.message(events), events }
  }

  markSent(events: AgentTeamTrackerEvent[]): void {
    this.clear(events)
  }

  private async deliver(): Promise<void> {
    const events = this.store.get().trackerEvents ?? []
    if (this.delivering || events.length === 0 || !syncEnabled(this.store.get())) {
      return
    }
    this.delivering = true
    try {
      const session = await findLiveManagerSession(this.runtime, agentTeamManagerFolder())
      if (!session) {
        return
      }
      // A busy Manager would get the update mid-turn; wait for it to go idle.
      const status = await this.runtime
        .getTerminalAgentStatus(session.terminalHandle)
        .catch(() => null)
      if (status?.status !== 'idle') {
        return
      }
      await this.runtime.sendTerminalAgentPrompt(session.terminalHandle, this.message(events), {
        inputKind: 'driving'
      })
      this.clear(events)
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
