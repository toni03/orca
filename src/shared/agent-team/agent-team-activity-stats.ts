import { openAssignment } from './agent-team-pipeline'
import type {
  AgentTeamAssignment,
  AgentTeamLimitPause,
  AgentTeamIssue,
  AgentTeamSeat,
  AgentTeamState
} from './agent-team-types'

export type AgentTeamTimeRange = { from: number; to: number }

export type AgentTeamUsageTotals = { activeMs: number; tokens: number }

export type AgentTeamActivityTotals = AgentTeamUsageTotals & { done: number; escalated: number }

export type AgentTeamDayActivity = AgentTeamActivityTotals & {
  dayStart: number
  repoIds: string[]
  /** Plan-limit pauses that overlapped the day. */
  limitPauses: AgentTeamLimitPause[]
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Local midnight of the day that contains `at`. */
export function startOfLocalDay(at: number): number {
  const date = new Date(at)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** The last `days` local days up to now, today included. */
export function lastDaysRange(days: number, now: number): AgentTeamTimeRange {
  const today = startOfLocalDay(now)
  return { from: startOfLocalDay(today - (days - 1) * DAY_MS + DAY_MS / 2), to: now }
}

/** Time a session ran inside the range; a running session counts up to now. */
export function activeMsInRange(
  assignment: AgentTeamAssignment,
  range: AgentTeamTimeRange,
  now: number
): number {
  const end = Math.min(assignment.endedAt ?? now, range.to)
  const start = Math.max(assignment.startedAt, range.from)
  return Math.max(0, end - start)
}

/** Tokens are read once a session ends, so they belong to the moment it ended. */
export function tokensInRange(assignment: AgentTeamAssignment, range: AgentTeamTimeRange): number {
  const endedAt = assignment.endedAt
  if (assignment.usage?.status !== 'known' || endedAt === undefined) {
    return 0
  }
  return endedAt >= range.from && endedAt <= range.to ? assignment.usage.totalTokens : 0
}

function sessions(
  state: AgentTeamState
): { issue: AgentTeamIssue; assignment: AgentTeamAssignment }[] {
  return state.issues.flatMap((issue) =>
    issue.assignments.map((assignment) => ({ issue, assignment }))
  )
}

function addUsage(
  totals: Map<string, AgentTeamUsageTotals>,
  key: string,
  activeMs: number,
  tokens: number
): void {
  if (activeMs === 0 && tokens === 0) {
    return
  }
  const current = totals.get(key) ?? { activeMs: 0, tokens: 0 }
  totals.set(key, { activeMs: current.activeMs + activeMs, tokens: current.tokens + tokens })
}

/** Active time and tokens in the range, grouped by project, seat or issue. */
export function usageBy(
  state: AgentTeamState,
  group: 'project' | 'seat' | 'issue',
  range: AgentTeamTimeRange,
  now: number
): Map<string, AgentTeamUsageTotals> {
  const totals = new Map<string, AgentTeamUsageTotals>()
  for (const { issue, assignment } of sessions(state)) {
    const key = group === 'project' ? issue.repoId : group === 'seat' ? assignment.seatId : issue.id
    addUsage(totals, key, activeMsInRange(assignment, range, now), tokensInRange(assignment, range))
  }
  return totals
}

function isIn(at: number | undefined, range: AgentTeamTimeRange): boolean {
  return at !== undefined && at >= range.from && at <= range.to
}

export function activityTotals(
  state: AgentTeamState,
  range: AgentTeamTimeRange,
  now: number
): AgentTeamActivityTotals {
  let activeMs = 0
  let tokens = 0
  for (const { assignment } of sessions(state)) {
    activeMs += activeMsInRange(assignment, range, now)
    tokens += tokensInRange(assignment, range)
  }
  return {
    activeMs,
    tokens,
    done: state.issues.filter((issue) => issue.status === 'done' && isIn(issue.updatedAt, range))
      .length,
    escalated: state.issues.filter(
      (issue) => issue.needsYou?.reason === 'escalated' && isIn(issue.needsYou.at, range)
    ).length
  }
}

/** One row per local day that had any work, newest first. */
export function dailyActivity(
  state: AgentTeamState,
  days: number,
  now: number
): AgentTeamDayActivity[] {
  const rows: AgentTeamDayActivity[] = []
  for (let offset = 0; offset < days; offset += 1) {
    const dayStart = startOfLocalDay(startOfLocalDay(now) - offset * DAY_MS + DAY_MS / 2)
    const range = { from: dayStart, to: Math.min(dayStart + DAY_MS - 1, now) }
    const totals = activityTotals(state, range, now)
    const repoIds = [
      ...new Set(
        sessions(state)
          .filter(({ assignment }) => activeMsInRange(assignment, range, now) > 0)
          .map(({ issue }) => issue.repoId)
      )
    ]
    const limitPauses = (state.limitPauses ?? []).filter(
      (pause) => pause.startedAt <= range.to && (pause.endedAt ?? now) >= range.from
    )
    const busy = totals.activeMs > 0 || totals.tokens > 0 || totals.done > 0 || totals.escalated > 0
    if (busy || limitPauses.length > 0) {
      rows.push({ ...totals, dayStart, repoIds, limitPauses })
    }
  }
  return rows
}

export type AgentTeamSeatStatus =
  | { kind: 'working'; issue: AgentTeamIssue; assignment: AgentTeamAssignment }
  | { kind: 'blocked'; issue: AgentTeamIssue; assignment: AgentTeamAssignment }
  | { kind: 'paused' }
  | { kind: 'limit'; resetsAt?: number }
  | { kind: 'idle' }

/** What a seat is doing now: a session that asks for input counts as blocked on the user. */
export function seatStatus(state: AgentTeamState, seat: AgentTeamSeat): AgentTeamSeatStatus {
  for (const issue of state.issues) {
    const open = openAssignment(issue)
    if (open?.seatId === seat.id) {
      return { kind: issue.status === 'needs-you' ? 'blocked' : 'working', issue, assignment: open }
    }
  }
  if (seat.paused) {
    return { kind: 'paused' }
  }
  const limit = (state.limitPauses ?? []).find(
    (pause) => pause.agent === seat.agent && pause.endedAt === undefined
  )
  if (limit) {
    return limit.resetsAt ? { kind: 'limit', resetsAt: limit.resetsAt } : { kind: 'limit' }
  }
  return { kind: 'idle' }
}

/** The seat's finished sessions, newest first. */
export function seatRecentSessions(
  state: AgentTeamState,
  seatId: string,
  limit: number
): { issue: AgentTeamIssue; assignment: AgentTeamAssignment }[] {
  return sessions(state)
    .filter(({ assignment }) => assignment.seatId === seatId && assignment.endedAt !== undefined)
    .sort((a, b) => (b.assignment.endedAt ?? 0) - (a.assignment.endedAt ?? 0))
    .slice(0, limit)
}
