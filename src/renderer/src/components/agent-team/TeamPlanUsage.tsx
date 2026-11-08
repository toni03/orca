import { getIntlLocale, translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getAgentLabel } from '@/lib/agent-catalog'
import { cn } from '@/lib/utils'
import type { AgentTeamSeat } from '../../../../shared/agent-team/agent-team-types'
import type { RateLimitWindow } from '../../../../shared/rate-limit-types'
import { agentPlanWindows } from '../../../../shared/agent-team/agent-team-plan-limits'
import type { TuiAgent } from '../../../../shared/tui-agent'

const NEAR_LIMIT_PERCENT = 80

export type TeamPlanUsageRow = {
  agent: TuiAgent
  session: RateLimitWindow | null
  weekly: RateLimitWindow | null
}

/** Plan windows of the agent CLIs the team's active seats run, as Orca already reads them. */
export function useTeamPlanUsage(seats: readonly AgentTeamSeat[]): TeamPlanUsageRow[] {
  const limits = useAppStore((s) => s.rateLimits)
  const agents = [
    ...new Set(seats.filter((seat) => seat.retiredAt === undefined).map((seat) => seat.agent))
  ]
  return agents.flatMap((agent) => {
    const provider = agentPlanWindows(agent, limits)
    if (!provider || (!provider.session && !provider.weekly)) {
      return []
    }
    return [{ agent, session: provider.session, weekly: provider.weekly }]
  })
}

export function resetLabel(window: RateLimitWindow): string | null {
  if (window.resetsAt) {
    const date = new Date(window.resetsAt)
    const sameDay = new Date().toDateString() === date.toDateString()
    return sameDay
      ? date.toLocaleTimeString(getIntlLocale(), { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleString(getIntlLocale(), {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })
  }
  return window.resetDescription
}

function Meter({ label, window }: { label: string; window: RateLimitWindow }): React.JSX.Element {
  const percent = Math.round(Math.min(100, Math.max(0, window.usedPercent)))
  const near = percent >= NEAR_LIMIT_PERCENT
  return (
    <span className="flex items-center gap-1.5 text-2xs">
      <span className="w-8 text-muted-foreground">{label}</span>
      <span
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 w-12 overflow-hidden rounded-full bg-muted"
      >
        <span
          className={cn('block h-full', near ? 'bg-agent-question' : 'bg-foreground')}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className={cn('font-medium', near && 'text-agent-question-text')}>{percent}%</span>
    </span>
  )
}

/** Compact header chip: 5-hour and weekly use for each agent plan, with the reset when near. */
export function TeamPlanUsageChip({
  rows
}: {
  rows: TeamPlanUsageRow[]
}): React.JSX.Element | null {
  if (rows.length === 0) {
    return null
  }
  return (
    <div className="flex items-center gap-3 rounded-md border border-border px-2.5 py-1">
      {rows.map((row) => {
        const near = (row.session?.usedPercent ?? 0) >= NEAR_LIMIT_PERCENT
        const reset = row.session ? resetLabel(row.session) : null
        return (
          <div key={row.agent} className="flex items-center gap-2">
            <span className="text-2xs font-medium">{getAgentLabel(row.agent)}</span>
            <span className="flex flex-col gap-0.5">
              {row.session ? (
                <Meter
                  label={translate('auto.components.agentTeam.TeamPlanUsage.fiveHour', '5 h')}
                  window={row.session}
                />
              ) : null}
              {row.weekly ? (
                <Meter
                  label={translate('auto.components.agentTeam.TeamPlanUsage.week', 'Week')}
                  window={row.weekly}
                />
              ) : null}
            </span>
            {near ? (
              <span className="text-2xs leading-tight text-agent-question-text">
                {translate('auto.components.agentTeam.TeamPlanUsage.nearLimit', 'Near limit')}
                {reset ? (
                  <span className="block text-muted-foreground">
                    {translate('auto.components.agentTeam.TeamPlanUsage.resets', 'resets {{at}}', {
                      at: reset
                    })}
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function UsageBar({
  title,
  window
}: {
  title: string
  window: RateLimitWindow
}): React.JSX.Element {
  const percent = Math.round(Math.min(100, Math.max(0, window.usedPercent)))
  const near = percent >= NEAR_LIMIT_PERCENT
  const reset = resetLabel(window)
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center text-sm">
        <span className="font-medium">{title}</span>
        <span className={cn('ml-auto font-semibold', near && 'text-agent-question-text')}>
          {near
            ? translate(
                'auto.components.agentTeam.TeamPlanUsage.percentNear',
                '{{percent}}% · near limit',
                {
                  percent
                }
              )
            : `${percent}%`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={title}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full', near ? 'bg-agent-question' : 'bg-primary')}
          style={{ width: `${percent}%` }}
        />
      </div>
      {reset ? (
        <div className="text-xs text-muted-foreground">
          {translate('auto.components.agentTeam.TeamPlanUsage.resetsAt', 'Resets {{at}}', {
            at: reset
          })}
        </div>
      ) : null}
    </div>
  )
}

/** Activity panel: one pair of bars per agent plan. */
export function TeamPlanUsageBars({ rows }: { rows: TeamPlanUsageRow[] }): React.JSX.Element {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.agentTeam.TeamPlanUsage.unavailable',
          'Plan usage appears here once Orca can read the limits of the agents your seats use.'
        )}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.agent} className="grid grid-cols-[6rem_1fr_1fr] items-start gap-6">
          <span className="text-sm font-medium">{getAgentLabel(row.agent)}</span>
          {row.session ? (
            <UsageBar
              title={translate(
                'auto.components.agentTeam.TeamPlanUsage.fiveHourWindow',
                '5-hour window'
              )}
              window={row.session}
            />
          ) : (
            <span />
          )}
          {row.weekly ? (
            <UsageBar
              title={translate('auto.components.agentTeam.TeamPlanUsage.weekly', 'Weekly')}
              window={row.weekly}
            />
          ) : (
            <span />
          )}
        </div>
      ))}
    </div>
  )
}
