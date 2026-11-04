import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { openAssignment, stepRole } from '../../../../shared/agent-team/agent-team-pipeline'
import { planAgentTeamAssignments } from '../../../../shared/agent-team/agent-team-scheduler'
import type { AgentTeamIssue, AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { TeamIssueCard } from './TeamIssueCard'
import { TeamNewIssueDialog } from './TeamNewIssueDialog'
import { TeamDecisionDialog } from './TeamDecisionDialog'
import { TeamIssueHistoryDialog } from './TeamIssueHistoryDialog'
import { TeamPausedNotice } from './TeamPausedNotice'
import { stepTypeLabel } from './team-labels'
import { useAgentTeamCommand } from './use-agent-team-state'
import { useNow } from './use-now'

const ALL_TEAMS = 'all'

type Column = { id: string; title: string; issues: AgentTeamIssue[] }

function boardColumns(state: AgentTeamState, teamFilter: string): Column[] {
  const inTeam = (issue: AgentTeamIssue): boolean =>
    teamFilter === ALL_TEAMS || issue.teamId === teamFilter
  const visible = state.issues.filter(inTeam).sort((a, b) => a.priority - b.priority)
  const queued = visible.filter(
    (issue) => issue.status === 'queued' || (issue.status === 'working' && !openAssignment(issue))
  )
  const running = visible.filter((issue) => issue.status === 'working' && openAssignment(issue))
  const team = state.teams.find((candidate) => candidate.id === teamFilter)
  const stepColumns: Column[] = team
    ? team.steps.map((step, index) => ({
        id: step.id,
        title: step.name,
        issues: running.filter((issue) => issue.stepIndex === index)
      }))
    : (['build', 'check'] as const).map((stepType) => ({
        id: stepType,
        title: stepTypeLabel(stepType),
        issues: running.filter((issue) => {
          const issueTeam = state.teams.find((candidate) => candidate.id === issue.teamId)
          return issueTeam
            ? stepRole(issueTeam, issue.stepIndex, state.roles)?.stepType === stepType
            : false
        })
      }))
  return [
    {
      id: 'registered',
      title: translate('auto.components.agentTeam.TeamBoard.notApproved', 'Not approved'),
      issues: visible.filter((issue) => issue.status === 'registered')
    },
    {
      id: 'queue',
      title: translate('auto.components.agentTeam.TeamBoard.queue', 'Priority queue'),
      issues: queued
    },
    ...stepColumns,
    {
      id: 'needs-you',
      title: translate('auto.components.agentTeam.TeamBoard.needsYou', 'Needs you'),
      issues: visible.filter((issue) => issue.status === 'needs-you')
    }
  ]
}

export function TeamBoard({
  state,
  onOpenSettings
}: {
  state: AgentTeamState
  onOpenSettings: () => void
}): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const run = useAgentTeamCommand()
  const now = useNow(30_000)
  const [teamFilter, setTeamFilter] = useState<string>(ALL_TEAMS)
  const [creating, setCreating] = useState(false)
  const [deciding, setDeciding] = useState<AgentTeamIssue | null>(null)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const waiting = useMemo(() => planAgentTeamAssignments(state).waiting, [state])
  const columns = useMemo(() => boardColumns(state, teamFilter), [state, teamFilter])
  const queueOrder = columns.find((column) => column.id === 'queue')?.issues ?? []
  const projectName = (repoId: string): string =>
    repos.find((repo) => repo.id === repoId)?.displayName ?? repoId

  const move = (issue: AgentTeamIssue, direction: -1 | 1): void => {
    const ids = queueOrder.map((candidate) => candidate.id)
    const from = ids.indexOf(issue.id)
    const to = from + direction
    if (from === -1 || to < 0 || to >= ids.length) {
      return
    }
    ids.splice(to, 0, ...ids.splice(from, 1))
    void run({ kind: 'queue.reorder', issueIds: ids })
  }

  if (state.teams.length === 0) {
    return (
      <div className="flex max-w-lg flex-col gap-3 py-8">
        <h2 className="text-base font-semibold">
          {translate('auto.components.agentTeam.TeamBoard.emptyTitle', 'Set up your first team')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamBoard.emptyBody',
            'A team is a pipeline of Build and Check steps with seats that take issues from every project. Create one from a template, add seats and link your projects.'
          )}
        </p>
        <Button className="self-start" onClick={onOpenSettings}>
          {translate('auto.components.agentTeam.TeamBoard.openSettings', 'Open team settings')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger
            size="sm"
            className="min-w-44"
            aria-label={translate('auto.components.agentTeam.TeamBoard.teamFilter', 'Team')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TEAMS}>
              {translate('auto.components.agentTeam.TeamBoard.allTeams', 'All teams')}
            </SelectItem>
            {state.teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
          <Plus />
          {translate('auto.components.agentTeam.TeamBoard.newIssue', 'New issue')}
        </Button>
      </div>
      <TeamPausedNotice state={state} teamFilter={teamFilter} />
      <div
        className="grid min-h-0 gap-3"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))` }}
      >
        {columns.map((column) => (
          <section
            key={column.id}
            aria-label={column.title}
            className="flex min-w-0 flex-col gap-2"
          >
            <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              {column.title}
              <span className="font-normal">{column.issues.length}</span>
            </h3>
            {column.issues.map((issue) => (
              <TeamIssueCard
                key={issue.id}
                issue={issue}
                state={state}
                now={now}
                projectName={projectName(issue.repoId)}
                waitReason={column.id === 'queue' ? waiting[issue.id] : undefined}
                onApprove={
                  column.id === 'registered'
                    ? () => void run({ kind: 'issue.approve', issueIds: [issue.id] })
                    : undefined
                }
                onMove={column.id === 'queue' ? (direction) => move(issue, direction) : undefined}
                onDecide={column.id === 'needs-you' ? setDeciding : undefined}
                onOpenHistory={(target) => setHistoryId(target.id)}
              />
            ))}
            {column.issues.length === 0 ? (
              <div className="h-10 rounded-lg border border-dashed border-border" />
            ) : null}
          </section>
        ))}
      </div>
      <TeamNewIssueDialog
        open={creating}
        onOpenChange={setCreating}
        state={state}
        defaultTeamId={teamFilter === ALL_TEAMS ? state.teams[0]?.id : teamFilter}
      />
      <TeamDecisionDialog issue={deciding} state={state} onClose={() => setDeciding(null)} />
      <TeamIssueHistoryDialog
        issueId={historyId}
        state={state}
        onClose={() => setHistoryId(null)}
      />
    </div>
  )
}
