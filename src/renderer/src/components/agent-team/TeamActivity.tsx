import { Fragment, useMemo, useState } from 'react'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { formatTokens } from '@/components/stats/usage-formatters'
import {
  activeMsInRange,
  activityTotals,
  dailyActivity,
  lastDaysRange,
  startOfLocalDay
} from '../../../../shared/agent-team/agent-team-activity-stats'
import type {
  AgentTeamLimitPause,
  AgentTeamState
} from '../../../../shared/agent-team/agent-team-types'
import { getAgentLabel } from '@/lib/agent-catalog/agent-catalog'
import { formatDuration, issueKey } from './team-labels'
import { AssignmentTokens, assignmentResultLabel } from './TeamAssignmentResult'
import { TeamIssueSheet } from './TeamIssueSheet'
import { TeamPlanUsageBars, useTeamPlanUsage } from './TeamPlanUsage'
import { TeamProjectAvatar } from './TeamProjectAvatar'
import { TeamActivityBreakdowns } from './TeamActivityBreakdowns'
import { useNow } from './use-now'

const RANGES = [1, 7, 30] as const
type RangeDays = (typeof RANGES)[number]
const HISTORY_DAYS = 14

function rangeLabel(days: RangeDays): string {
  switch (days) {
    case 1:
      return translate('auto.components.agentTeam.TeamActivity.today', 'Today')
    case 7:
      return translate('auto.components.agentTeam.TeamActivity.last7', 'Last 7 days')
    case 30:
      return translate('auto.components.agentTeam.TeamActivity.last30', 'Last 30 days')
  }
}

function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString(getIntlLocale(), { hour: '2-digit', minute: '2-digit' })
}

function limitPauseLabel(pause: AgentTeamLimitPause, now: number): string {
  return translate(
    'auto.components.agentTeam.TeamActivity.limitPause',
    '{{agent}} seats paused at the plan limit {{from}} → {{to}}',
    {
      agent: getAgentLabel(pause.agent),
      from: clockTime(pause.startedAt),
      to: pause.endedAt
        ? clockTime(pause.endedAt)
        : pause.resetsAt && pause.resetsAt > now
          ? clockTime(pause.resetsAt)
          : '…'
    }
  )
}

export function TeamActivity({ state }: { state: AgentTeamState }): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const now = useNow(60_000)
  const [days, setDays] = useState<RangeDays>(1)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const plan = useTeamPlanUsage(state.seats)
  const range = lastDaysRange(days, now)
  const totals = activityTotals(state, range, now)
  const history = useMemo(() => dailyActivity(state, HISTORY_DAYS, now), [state, now])
  const repoOf = (id: string) => repos.find((repo) => repo.id === id)
  const projectName = (id: string): string => repoOf(id)?.displayName ?? id

  const sessions = state.issues
    .flatMap((issue) => issue.assignments.map((assignment) => ({ issue, assignment })))
    .filter(({ assignment }) => activeMsInRange(assignment, range, now) > 0)
    .sort((a, b) => b.assignment.startedAt - a.assignment.startedAt)
  const today = startOfLocalDay(now)
  const cell = 'px-3 py-2'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center">
        <Select
          value={String(days)}
          onValueChange={(value) => {
            const next = RANGES.find((candidate) => String(candidate) === value)
            if (next) {
              setDays(next)
            }
          }}
        >
          <SelectTrigger
            size="sm"
            className="ml-auto min-w-36"
            aria-label={translate('auto.components.agentTeam.TeamActivity.range', 'Range')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((value) => (
              <SelectItem key={value} value={String(value)}>
                {rangeLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <section
        aria-label={translate('auto.components.agentTeam.TeamActivity.planUsage', 'Plan usage')}
        className="grid grid-cols-[1fr_auto] items-center gap-6 rounded-lg border border-border/60 bg-muted/30 px-4 py-3"
      >
        <TeamPlanUsageBars rows={plan} />
        <div className="flex flex-col gap-0.5 text-right">
          <span className="text-2xs font-medium uppercase text-muted-foreground">
            {rangeLabel(days)}
          </span>
          <span className="text-[15px] font-semibold">
            {formatDuration(totals.activeMs)} ·{' '}
            {translate('auto.components.agentTeam.TeamActivity.tokens', '{{value}} tokens', {
              value: formatTokens(totals.tokens)
            })}
          </span>
          <span className="text-xs text-muted-foreground">
            {translate(
              'auto.components.agentTeam.TeamActivity.doneEscalated',
              '{{done}} issues done · {{escalated}} escalated',
              { done: totals.done, escalated: totals.escalated }
            )}
          </span>
        </div>
      </section>
      <TeamActivityBreakdowns state={state} range={range} now={now} onOpenIssue={setSheetId} />
      <section
        aria-label={translate('auto.components.agentTeam.TeamActivity.daily', 'Daily history')}
        className="overflow-auto rounded-lg border border-border/60 scrollbar-sleek"
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-2xs uppercase text-muted-foreground">
            <tr>
              <th className={`${cell} font-medium`}>
                {translate('auto.components.agentTeam.TeamActivity.colDay', 'Day')}
              </th>
              <th className={`${cell} font-medium`}>
                {translate('auto.components.agentTeam.TeamActivity.colDone', 'Issues done')}
              </th>
              <th className={`${cell} font-medium`}>
                {translate('auto.components.agentTeam.TeamActivity.colEscalated', 'Escalated')}
              </th>
              <th className={`${cell} font-medium`}>
                {translate('auto.components.agentTeam.TeamActivity.colProjects', 'Projects')}
              </th>
              <th className={`${cell} text-right font-medium`}>
                {translate('auto.components.agentTeam.TeamActivity.colTime', 'Active time')}
              </th>
              <th className={`${cell} text-right font-medium`}>
                {translate('auto.components.agentTeam.TeamActivity.colTokens', 'Tokens')}
              </th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr className="border-t border-border/60">
                <td className={`${cell} text-muted-foreground`} colSpan={6}>
                  {translate(
                    'auto.components.agentTeam.TeamActivity.empty',
                    'No sessions yet. Approved issues start when a seat is free.'
                  )}
                </td>
              </tr>
            ) : (
              history.map((row) => (
                <Fragment key={row.dayStart}>
                  <tr className="border-t border-border/60">
                    <td className={cell}>
                      {row.dayStart === today
                        ? translate('auto.components.agentTeam.TeamActivity.today', 'Today')
                        : new Date(row.dayStart).toLocaleDateString(getIntlLocale(), {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short'
                          })}
                    </td>
                    <td className={cell}>{row.done}</td>
                    <td className={cell}>{row.escalated}</td>
                    <td className={cell}>
                      <span className="flex items-center gap-1">
                        {row.repoIds.map((id) => (
                          <TeamProjectAvatar key={id} repo={repoOf(id)} name={projectName(id)} />
                        ))}
                        <span className="text-xs text-muted-foreground">{row.repoIds.length}</span>
                      </span>
                    </td>
                    <td className={`${cell} text-right`}>{formatDuration(row.activeMs)}</td>
                    <td className={`${cell} text-right`}>
                      {row.tokens > 0 ? formatTokens(row.tokens) : '—'}
                    </td>
                  </tr>
                  {row.limitPauses.map((pause) => (
                    <tr
                      key={`${pause.agent}:${pause.startedAt}`}
                      className="text-xs text-muted-foreground"
                    >
                      <td className={cell} />
                      <td className={cell} colSpan={5}>
                        {limitPauseLabel(pause, now)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </section>
      {sessions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {translate('auto.components.agentTeam.TeamActivity.sessions', 'Sessions')}
          </h2>
          <div className="overflow-auto rounded-lg border border-border/60 scrollbar-sleek">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-2xs uppercase text-muted-foreground">
                <tr>
                  <th className={`${cell} font-medium`}>
                    {translate('auto.components.agentTeam.TeamActivity.colIssue', 'Issue')}
                  </th>
                  <th className={`${cell} font-medium`}>
                    {translate('auto.components.agentTeam.TeamActivity.colStep', 'Step')}
                  </th>
                  <th className={`${cell} font-medium`}>
                    {translate('auto.components.agentTeam.TeamActivity.colSeat', 'Seat')}
                  </th>
                  <th className={`${cell} font-medium`}>
                    {translate('auto.components.agentTeam.TeamActivity.colRound', 'Round')}
                  </th>
                  <th className={`${cell} font-medium`}>
                    {translate('auto.components.agentTeam.TeamActivity.colResult', 'Result')}
                  </th>
                  <th className={`${cell} text-right font-medium`}>
                    {translate('auto.components.agentTeam.TeamActivity.colTime', 'Active time')}
                  </th>
                  <th className={`${cell} text-right font-medium`}>
                    {translate('auto.components.agentTeam.TeamActivity.colTokens', 'Tokens')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(({ issue, assignment }) => (
                  <tr key={assignment.id} className="border-t border-border/60">
                    <td className={cell}>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-left hover:underline"
                        onClick={() => setSheetId(issue.id)}
                      >
                        <TeamProjectAvatar
                          repo={repoOf(issue.repoId)}
                          name={projectName(issue.repoId)}
                        />
                        <span className="font-mono">{issueKey(issue)}</span> {issue.title}
                      </button>
                    </td>
                    <td className={cell}>
                      {state.teams
                        .find((team) => team.id === issue.teamId)
                        ?.steps.find((step) => step.id === assignment.stepId)?.name ?? '—'}
                    </td>
                    <td className={cell}>
                      {state.seats.find((seat) => seat.id === assignment.seatId)?.name ?? '—'}
                    </td>
                    <td className={cell}>{assignment.round}</td>
                    <td className={cell}>{assignmentResultLabel(assignment)}</td>
                    <td className={`${cell} text-right font-mono`}>
                      {formatDuration((assignment.endedAt ?? now) - assignment.startedAt)}
                    </td>
                    <td className={`${cell} text-right font-mono`}>
                      <AssignmentTokens assignment={assignment} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <TeamIssueSheet issueId={sheetId} state={state} onClose={() => setSheetId(null)} />
    </div>
  )
}
