import { useMemo } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type {
  AgentTeamAssignment,
  AgentTeamIssue,
  AgentTeamState
} from '../../../../shared/agent-team/agent-team-types'
import { formatTokens } from '@/components/stats/usage-formatters'
import { formatDuration, issueKey } from './team-labels'
import { useNow } from './use-now'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

type Row = { issue: AgentTeamIssue; assignment: AgentTeamAssignment }

function resultLabel(assignment: AgentTeamAssignment): string {
  if (assignment.result) {
    switch (assignment.result.kind) {
      case 'done':
        return translate('auto.components.agentTeam.TeamActivity.done', 'Done')
      case 'blocked':
        return translate('auto.components.agentTeam.TeamActivity.blocked', 'Blocked')
      case 'pass':
        return translate('auto.components.agentTeam.TeamActivity.pass', 'Passed')
      case 'changes':
        return translate('auto.components.agentTeam.TeamActivity.changes', 'Changes requested')
    }
  }
  if (assignment.stopReason) {
    return assignment.stopReason === 'cancelled'
      ? translate('auto.components.agentTeam.TeamActivity.cancelled', 'Cancelled')
      : translate('auto.components.agentTeam.TeamActivity.stopped', 'Stopped without a result')
  }
  return assignment.endedAt === undefined
    ? translate('auto.components.agentTeam.TeamActivity.running', 'Running')
    : '—'
}

function TokensCell({ assignment }: { assignment: AgentTeamAssignment }): React.JSX.Element {
  const usage = assignment.usage
  if (!usage) {
    return (
      <span className="text-muted-foreground">{assignment.endedAt === undefined ? '' : '…'}</span>
    )
  }
  if (usage.status === 'unavailable') {
    return (
      <span className="text-muted-foreground" title={usage.reason}>
        —
      </span>
    )
  }
  return (
    <span
      title={translate(
        'auto.components.agentTeam.TeamActivity.tokensDetail',
        'Input {{input}} · output {{output}} · cache read {{cache}}',
        {
          input: formatTokens(usage.inputTokens),
          output: formatTokens(usage.outputTokens),
          cache: formatTokens(usage.cacheReadTokens)
        }
      )}
    >
      {formatTokens(usage.totalTokens)}
    </span>
  )
}

export function TeamActivity({ state }: { state: AgentTeamState }): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const now = useNow(60_000)
  const rows = useMemo<Row[]>(
    () =>
      state.issues
        .flatMap((issue) => issue.assignments.map((assignment) => ({ issue, assignment })))
        .sort((a, b) => b.assignment.startedAt - a.assignment.startedAt),
    [state.issues]
  )
  const weekBySeat = useMemo(() => {
    const totals = new Map<string, number>()
    for (const { assignment } of rows) {
      const end = assignment.endedAt ?? now
      const start = Math.max(assignment.startedAt, now - WEEK_MS)
      if (end > start) {
        totals.set(assignment.seatId, (totals.get(assignment.seatId) ?? 0) + end - start)
      }
    }
    return totals
  }, [rows, now])
  const weekTokensBySeat = useMemo(() => {
    const totals = new Map<string, number>()
    for (const { assignment } of rows) {
      if (assignment.usage?.status === 'known' && (assignment.endedAt ?? 0) >= now - WEEK_MS) {
        const total = (totals.get(assignment.seatId) ?? 0) + assignment.usage.totalTokens
        totals.set(assignment.seatId, total)
      }
    }
    return totals
  }, [rows, now])

  if (rows.length === 0) {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        {translate(
          'auto.components.agentTeam.TeamActivity.empty',
          'No sessions yet. Approved issues start when a seat is free.'
        )}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamActivity.weekWithTokens',
            'Active time and tokens, last 7 days'
          )}
        </h2>
        <div className="flex flex-wrap gap-2">
          {state.seats
            .filter((seat) => weekBySeat.has(seat.id))
            .map((seat) => (
              <div key={seat.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="font-medium">{seat.name}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {formatDuration(weekBySeat.get(seat.id) ?? 0)}
                  {weekTokensBySeat.has(seat.id)
                    ? ` · ${translate('auto.components.agentTeam.TeamActivity.tokens', '{{value}} tokens', { value: formatTokens(weekTokensBySeat.get(seat.id) ?? 0) })}`
                    : ''}
                </div>
              </div>
            ))}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {translate('auto.components.agentTeam.TeamActivity.sessions', 'Sessions')}
        </h2>
        <div className="overflow-auto rounded-lg border border-border scrollbar-sleek">
          <table className="w-full text-left text-xs">
            <thead className="text-2xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">
                  {translate('auto.components.agentTeam.TeamActivity.colIssue', 'Issue')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {translate('auto.components.agentTeam.TeamActivity.colStep', 'Step')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {translate('auto.components.agentTeam.TeamActivity.colSeat', 'Seat')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {translate('auto.components.agentTeam.TeamActivity.colRound', 'Round')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {translate('auto.components.agentTeam.TeamActivity.colResult', 'Result')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {translate('auto.components.agentTeam.TeamActivity.colTime', 'Active time')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {translate('auto.components.agentTeam.TeamActivity.colTokens', 'Tokens')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ issue, assignment }) => {
                const step = state.teams
                  .find((team) => team.id === issue.teamId)
                  ?.steps.find((candidate) => candidate.id === assignment.stepId)
                const seat = state.seats.find((candidate) => candidate.id === assignment.seatId)
                const project =
                  repos.find((repo) => repo.id === issue.repoId)?.displayName ?? issue.repoId
                return (
                  <tr key={assignment.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <span className="text-muted-foreground">{project} </span>
                      <span className="font-mono">{issueKey(issue)}</span> {issue.title}
                    </td>
                    <td className="px-3 py-2">{step?.name ?? '—'}</td>
                    <td className="px-3 py-2">{seat?.name ?? '—'}</td>
                    <td className="px-3 py-2">{assignment.round}</td>
                    <td className="px-3 py-2">{resultLabel(assignment)}</td>
                    <td className="px-3 py-2 font-mono">
                      {formatDuration((assignment.endedAt ?? now) - assignment.startedAt)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      <TokensCell assignment={assignment} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
