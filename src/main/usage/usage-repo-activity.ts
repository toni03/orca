import { getLocalUsageDay } from './usage-calendar-range'

export type UsageRepoActivity = { tokens: number; activeMs: number }

type SessionSpan = { firstTimestamp: string; lastTimestamp: string; primaryRepoId: string | null }
type DayTokens = { day: string; repoId: string | null; tokens: number }

/** Tokens and session time one project used between two instants, from a usage store's rollups. */
export function repoActivityInRange(
  input: { sessions: readonly SessionSpan[]; days: readonly DayTokens[] },
  repoId: string,
  from: number,
  to: number
): UsageRepoActivity {
  const firstDay = getLocalUsageDay(new Date(from).toISOString())
  const lastDay = getLocalUsageDay(new Date(to).toISOString())
  // Daily rollups are the only per-project token source, so the range counts whole days.
  const tokens = input.days
    .filter(
      (row) =>
        row.repoId === repoId &&
        firstDay !== null &&
        lastDay !== null &&
        row.day >= firstDay &&
        row.day <= lastDay
    )
    .reduce((total, row) => total + row.tokens, 0)
  const activeMs = input.sessions
    .filter((session) => session.primaryRepoId === repoId)
    .reduce((total, session) => {
      const start = Math.max(new Date(session.firstTimestamp).getTime(), from)
      const end = Math.min(new Date(session.lastTimestamp).getTime(), to)
      return Number.isFinite(start) && Number.isFinite(end) && end > start
        ? total + end - start
        : total
    }, 0)
  return { tokens, activeMs }
}
