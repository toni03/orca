import { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { formatTokens } from '@/components/stats/usage-formatters'
import {
  usageBy,
  type AgentTeamTimeRange,
  type AgentTeamUsageTotals
} from '../../../../shared/agent-team/agent-team-activity-stats'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { formatDuration, issueKey } from './team-labels'
import { TeamProjectAvatar } from './TeamProjectAvatar'

const TOP_ISSUES = 4
/** Transcript rollups refresh on their own scan; rereading more often adds nothing. */
const MANAGER_REFRESH_MS = 5 * 60_000

type Row = { key: string; label: React.ReactNode; usage: AgentTeamUsageTotals }

const byActive = (a: Row, b: Row): number =>
  b.usage.activeMs - a.usage.activeMs || b.usage.tokens - a.usage.tokens

function BreakdownCard({ title, rows }: { title: string; rows: Row[] }): React.JSX.Element {
  return (
    <section aria-label={title} className="overflow-hidden rounded-lg border border-border/60">
      <h3 className="flex h-8 items-center bg-muted/40 px-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">—</p>
      ) : (
        rows.map((row) => (
          <div
            key={row.key}
            className="grid h-9 grid-cols-[1fr_4rem_4rem] items-center gap-2 border-t border-border/60 px-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-1.5">{row.label}</span>
            <span className="text-right text-xs text-muted-foreground">
              {row.usage.activeMs > 0 ? formatDuration(row.usage.activeMs) : '—'}
            </span>
            <span className="text-right text-xs">
              {row.usage.tokens > 0 ? formatTokens(row.usage.tokens) : '—'}
            </span>
          </div>
        ))
      )}
    </section>
  )
}

/** The Manager is not a seat, so its usage comes from its own folder's transcripts. */
function useManagerActivity(range: AgentTeamTimeRange): AgentTeamUsageTotals | null {
  const [activity, setActivity] = useState<AgentTeamUsageTotals | null>(null)
  const { from } = range
  useEffect(() => {
    let cancelled = false
    const read = (): void => {
      void window.api.agentTeam
        .managerActivity(from, Date.now())
        .then((next) => {
          if (!cancelled) {
            setActivity(next)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setActivity(null)
          }
        })
    }
    read()
    const timer = window.setInterval(read, MANAGER_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [from])
  return activity
}

export function TeamActivityBreakdowns({
  state,
  range,
  now,
  onOpenIssue
}: {
  state: AgentTeamState
  range: AgentTeamTimeRange
  now: number
  onOpenIssue: (issueId: string) => void
}): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const manager = useManagerActivity(range)
  const repoOf = (id: string) => repos.find((repo) => repo.id === id)
  const projectName = (id: string): string => repoOf(id)?.displayName ?? id

  const byProject = [...usageBy(state, 'project', range, now)]
    .map(([key, usage]) => ({
      key,
      usage,
      label: (
        <>
          <TeamProjectAvatar repo={repoOf(key)} name={projectName(key)} />
          <span className="truncate">{projectName(key)}</span>
        </>
      )
    }))
    .sort(byActive)
  const bySeat: Row[] = [...usageBy(state, 'seat', range, now)]
    .map(([key, usage]) => ({
      key,
      usage,
      label: (
        <span className="truncate">
          {state.seats.find((seat) => seat.id === key)?.name ?? key.slice(0, 6)}
        </span>
      )
    }))
    .sort(byActive)
  if (manager && (manager.tokens > 0 || manager.activeMs > 0)) {
    bySeat.push({
      key: 'manager',
      usage: manager,
      label: (
        <span className="truncate">
          {translate('auto.components.agentTeam.TeamActivityBreakdowns.manager', 'Manager')}
        </span>
      )
    })
  }
  const byIssue = [...usageBy(state, 'issue', range, now)]
    .flatMap(([key, usage]) => {
      const issue = state.issues.find((candidate) => candidate.id === key)
      return issue
        ? [
            {
              key,
              usage,
              label: (
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-1.5 text-left hover:underline"
                  onClick={() => onOpenIssue(issue.id)}
                >
                  <TeamProjectAvatar repo={repoOf(issue.repoId)} name={projectName(issue.repoId)} />
                  <span className="font-mono text-xs text-muted-foreground">{issueKey(issue)}</span>
                  <span className="truncate">{issue.title}</span>
                </button>
              )
            }
          ]
        : []
    })
    .sort((a, b) => b.usage.tokens - a.usage.tokens || b.usage.activeMs - a.usage.activeMs)
    .slice(0, TOP_ISSUES)

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <BreakdownCard
        title={translate('auto.components.agentTeam.TeamActivity.byProject', 'By project')}
        rows={byProject}
      />
      <BreakdownCard
        title={translate('auto.components.agentTeam.TeamActivity.byAgent', 'By agent')}
        rows={bySeat}
      />
      <BreakdownCard
        title={translate(
          'auto.components.agentTeam.TeamActivity.byIssue',
          'By issue · top {{count}}',
          { count: TOP_ISSUES }
        )}
        rows={byIssue}
      />
    </div>
  )
}
