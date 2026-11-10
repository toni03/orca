import { useState } from 'react'
import { ChevronDown, CircleAlert, Gauge, LoaderCircle, Pause, SquareTerminal } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { formatTokens } from '@/components/stats/usage-formatters'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { cn } from '@/lib/utils'
import {
  lastDaysRange,
  seatRecentSessions,
  seatStatus,
  usageBy,
  type AgentTeamUsageTotals
} from '../../../../shared/agent-team/agent-team-activity-stats'
import type { AgentTeamSeat, AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { formatDuration, issueKey } from './team-labels'
import { assignmentResultLabel } from './TeamAssignmentResult'
import { TeamProjectAvatar } from './TeamProjectAvatar'
import { revealSession, sessionActivityLine, useSessionStatus } from './team-session-pane'

const RECENT_SESSIONS = 3

function StatusLabel({
  status
}: {
  status: ReturnType<typeof seatStatus>['kind']
}): React.JSX.Element {
  switch (status) {
    case 'working':
      return (
        <span className="inline-flex items-center gap-1 text-2xs">
          <LoaderCircle className="size-3 animate-spin text-agent-working" />
          {translate('auto.components.agentTeam.TeamSeatStrip.working', 'Working')}
        </span>
      )
    case 'blocked':
      return (
        <span className="inline-flex items-center gap-1 text-2xs text-agent-question-text">
          <CircleAlert className="size-3" />
          {translate('auto.components.agentTeam.TeamSeatStrip.blocked', 'Needs you')}
        </span>
      )
    case 'paused':
      return (
        <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
          <Pause className="size-3" />
          {translate('auto.components.agentTeam.TeamSettingsTeams.pausedBadge', 'Paused')}
        </span>
      )
    case 'limit':
      return (
        <span className="inline-flex items-center gap-1 text-2xs text-agent-question-text">
          <Gauge className="size-3" />
          {translate('auto.components.agentTeam.TeamSeatStrip.limit', 'Plan limit')}
        </span>
      )
    case 'idle':
      return (
        <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground/50" />
          {translate('auto.components.agentTeam.TeamSeatStrip.idle', 'Idle')}
        </span>
      )
  }
}

function SeatCard({
  seat,
  state,
  today,
  now,
  onOpenIssue
}: {
  seat: AgentTeamSeat
  state: AgentTeamState
  today: AgentTeamUsageTotals | undefined
  now: number
  onOpenIssue: (issueId: string) => void
}): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const [historyOpen, setHistoryOpen] = useState(false)
  const status = seatStatus(state, seat)
  const current = status.kind === 'working' || status.kind === 'blocked' ? status : null
  const live = useSessionStatus(current?.assignment.terminalHandle)
  const activity = sessionActivityLine(live)
  const repo = current
    ? repos.find((candidate) => candidate.id === current.issue.repoId)
    : undefined
  const recent = seatRecentSessions(state, seat.id, RECENT_SESSIONS)
  const last = recent[0]
  return (
    <div
      className={cn(
        'flex w-60 shrink-0 flex-col gap-1.5 rounded-lg border border-border/60 bg-card p-2.5',
        status.kind === 'blocked' && 'border-agent-question',
        status.kind === 'paused' && 'opacity-70'
      )}
    >
      <div className="flex items-center gap-2">
        <AgentIcon agent={seat.agent} size={14} />
        <span className="truncate text-sm font-medium">{seat.name}</span>
        <span className="ml-auto">
          <StatusLabel status={status.kind} />
        </span>
      </div>
      {current ? (
        <button
          type="button"
          onClick={() => onOpenIssue(current.issue.id)}
          className="flex min-w-0 items-center gap-1.5 text-left text-xs hover:underline"
        >
          <TeamProjectAvatar repo={repo} name={repo?.displayName ?? current.issue.repoId} />
          <span className="font-mono text-muted-foreground">{issueKey(current.issue)}</span>
          <span className="truncate">{current.issue.title}</span>
        </button>
      ) : (
        <span className="truncate text-xs text-muted-foreground">
          {last
            ? translate(
                'auto.components.agentTeam.TeamSeatStrip.last',
                'Last: {{key}} · {{result}}',
                {
                  key: issueKey(last.issue),
                  result: assignmentResultLabel(last.assignment)
                }
              )
            : translate('auto.components.agentTeam.TeamSeatStrip.noTask', 'No task')}
        </span>
      )}
      {activity ? (
        <div className="truncate font-mono text-2xs text-muted-foreground" title={activity}>
          {activity}
        </div>
      ) : null}
      <div className="flex items-center gap-2 font-mono text-2xs text-muted-foreground">
        <span>
          {current
            ? formatDuration(now - current.assignment.startedAt)
            : translate('auto.components.agentTeam.TeamSeatStrip.todayTime', '{{time}} today', {
                time: formatDuration(today?.activeMs ?? 0)
              })}
        </span>
        {today && today.tokens > 0 ? (
          <span>
            {translate('auto.components.agentTeam.TeamActivity.tokens', '{{value}} tokens', {
              value: formatTokens(today.tokens)
            })}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        {current?.issue.worktreeId ? (
          <Button
            size="xs"
            variant="outline"
            onClick={() =>
              current.issue.worktreeId && revealSession(live, current.issue.worktreeId)
            }
          >
            <SquareTerminal />
            {translate('auto.components.agentTeam.TeamIssueSheet.goToSession', 'Go to session')}
          </Button>
        ) : null}
        {recent.length > 0 ? (
          <Button
            size="xs"
            variant="ghost"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((value) => !value)}
          >
            {translate('auto.components.agentTeam.TeamSeatStrip.history', 'History')}
            <ChevronDown className={cn('transition-transform', historyOpen && 'rotate-180')} />
          </Button>
        ) : null}
      </div>
      {historyOpen ? (
        <ul className="flex flex-col gap-1 border-t border-border/60 pt-1.5">
          {recent.map(({ issue, assignment }) => {
            const sessionRepo = repos.find((candidate) => candidate.id === issue.repoId)
            return (
              <li key={assignment.id}>
                <button
                  type="button"
                  onClick={() => onOpenIssue(issue.id)}
                  className="flex w-full min-w-0 items-center gap-1.5 text-left text-2xs hover:underline"
                >
                  <TeamProjectAvatar
                    repo={sessionRepo}
                    name={sessionRepo?.displayName ?? issue.repoId}
                  />
                  <span className="font-mono text-muted-foreground">{issueKey(issue)}</span>
                  <span className="ml-auto truncate text-muted-foreground">
                    {assignmentResultLabel(assignment)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

type SeatRow = { id: string; name: string; seats: AgentTeamSeat[] }

/** One row per team with the seats its steps use, in step order; seats no team uses go last. */
function seatRowsByTeam(state: AgentTeamState): SeatRow[] {
  const active = new Map(
    state.seats.filter((seat) => seat.retiredAt === undefined).map((seat) => [seat.id, seat])
  )
  const placed = new Set<string>()
  const rows: SeatRow[] = []
  for (const team of state.teams) {
    const ids = [...new Set(team.steps.flatMap((step) => step.seatIds))]
    const seats = ids.flatMap((id) => {
      const seat = active.get(id)
      return seat ? [seat] : []
    })
    if (seats.length > 0) {
      seats.forEach((seat) => placed.add(seat.id))
      rows.push({ id: team.id, name: team.name, seats })
    }
  }
  const unplaced = [...active.values()].filter((seat) => !placed.has(seat.id))
  if (unplaced.length > 0) {
    rows.push({
      id: 'unassigned',
      name: translate('auto.components.agentTeam.TeamSeatStrip.noTeam', 'No team'),
      seats: unplaced
    })
  }
  return rows
}

/** One card per active seat, a row per team: what it is doing, its time and tokens today, its last results. */
export function TeamSeatStrip({
  state,
  now,
  onOpenIssue
}: {
  state: AgentTeamState
  now: number
  onOpenIssue: (issueId: string) => void
}): React.JSX.Element | null {
  const rows = seatRowsByTeam(state)
  if (rows.length === 0) {
    return null
  }
  const today = usageBy(state, 'seat', lastDaysRange(1, now), now)
  return (
    <section
      aria-label={translate('auto.components.agentTeam.TeamSeatStrip.label', 'Seats')}
      className="flex flex-col gap-2"
    >
      {rows.map((row) => (
        <div key={row.id} className="flex min-w-0 flex-col gap-1">
          <h3 className="text-xs font-medium text-muted-foreground">{row.name}</h3>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-sleek">
            {row.seats.map((seat) => (
              <SeatCard
                key={seat.id}
                seat={seat}
                state={state}
                today={today.get(seat.id)}
                now={now}
                onOpenIssue={onOpenIssue}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
