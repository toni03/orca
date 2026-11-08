import { ChevronDown } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatTokens } from '@/components/stats/usage-formatters'
import { cn } from '@/lib/utils'
import type { AgentTeamUsageTotals } from '../../../../shared/agent-team/agent-team-activity-stats'
import type { Repo } from '../../../../shared/repo-types'
import type { AgentTeamIssue, AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import type { BoardColumn } from './team-board-columns'
import { TeamProjectAvatar } from './TeamProjectAvatar'
import { formatDuration, trackerLabel } from './team-labels'

type Props = {
  repo: Repo
  state: AgentTeamState
  columns: BoardColumn[]
  gridTemplate: string
  open: number
  today: AgentTeamUsageTotals | undefined
  collapsed: boolean
  onToggle: () => void
  renderCards: (column: BoardColumn, issues: AgentTeamIssue[], lane: boolean) => React.ReactNode
}

/** One project row of the board grouped by project, with its own copy of every column. */
export function TeamBoardLane({
  repo,
  state,
  columns,
  gridTemplate,
  open,
  today,
  collapsed,
  onToggle,
  renderCards
}: Props): React.JSX.Element {
  const tracker = state.projects.find((project) => project.repoId === repo.id)?.tracker
  return (
    <section
      aria-label={repo.displayName}
      className="overflow-hidden rounded-lg border border-border/60"
    >
      <div className="flex h-10 items-center gap-2 border-b border-border/60 bg-muted/40 px-2 text-sm">
        <Button
          size="icon-xs"
          variant="ghost"
          aria-expanded={!collapsed}
          aria-label={translate(
            'auto.components.agentTeam.TeamBoard.collapseLane',
            'Collapse {{project}}',
            {
              project: repo.displayName
            }
          )}
          onClick={onToggle}
        >
          <ChevronDown className={cn('transition-transform', collapsed && '-rotate-90')} />
        </Button>
        <TeamProjectAvatar repo={repo} name={repo.displayName} />
        <span className="font-semibold">{repo.displayName}</span>
        {tracker ? <Badge variant="outline">{trackerLabel(tracker.provider)}</Badge> : null}
        <span className="text-xs text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamBoard.laneSummary',
            '{{open}} open · {{time}} active · {{tokens}} tokens today',
            {
              open,
              time: formatDuration(today?.activeMs ?? 0),
              tokens: formatTokens(today?.tokens ?? 0)
            }
          )}
        </span>
      </div>
      {collapsed ? null : (
        <div className="grid gap-3 p-2" style={{ gridTemplateColumns: gridTemplate }}>
          {columns.map((column) => (
            <div key={column.id} className="flex min-w-0 flex-col gap-2">
              {renderCards(
                column,
                column.issues.filter((issue) => issue.repoId === repo.id),
                true
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
