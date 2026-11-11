import { useMemo, useState } from 'react'
import { CircleCheck, Plus } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import RepoMultiCombobox from '@/components/ui/repo-multi-combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { lastDaysRange, usageBy } from '../../../../shared/agent-team/agent-team-activity-stats'
import { planAgentTeamAssignments } from '../../../../shared/agent-team/agent-team-scheduler'
import type { Repo } from '../../../../shared/repo-types'
import type { AgentTeamIssue, AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import {
  ALL_TEAMS,
  boardColumns,
  readBoardPrefs,
  saveBoardPrefs,
  type BoardColumn,
  type BoardPrefs
} from './team-board-columns'
import { TeamIssueCard } from './TeamIssueCard'
import { TeamIssueSheet } from './TeamIssueSheet'
import { TeamNewIssueDialog } from './TeamNewIssueDialog'
import { TeamPausedNotice } from './TeamPausedNotice'
import { TeamProjectAvatar } from './TeamProjectAvatar'
import { TeamBoardNoIssues, TeamBoardNoTeams } from './TeamBoardEmpty'
import { TeamBoardLane } from './TeamBoardLane'
import { TeamLaunchFailures } from './TeamLaunchFailures'
import { TeamSeatStrip } from './TeamSeatStrip'
import { TeamTrackerSyncStatus } from './TeamTrackerSyncStatus'
import { trackerLabel } from './team-labels'
import { useAgentTeamCommand } from './use-agent-team-state'
import { useNow } from './use-now'
import { projectTracker } from '../../../../shared/agent-team/agent-team-project-tracker'

const DONE_SHOWN = 20

type Props = {
  state: AgentTeamState
  onOpenSettings: () => void
  onOpenManager: () => void
}

export function TeamBoard({ state, onOpenSettings, onOpenManager }: Props): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const run = useAgentTeamCommand()
  const now = useNow(30_000)
  const [teamFilter, setTeamFilter] = useState<string>(ALL_TEAMS)
  const [prefs, setPrefs] = useState<BoardPrefs>(readBoardPrefs)
  const [doneOpen, setDoneOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; over: string | null } | null>(null)
  const waiting = useMemo(() => planAgentTeamAssignments(state).waiting, [state])

  const projectRepos = useMemo(() => {
    const ids = new Set([
      ...state.projects.map((project) => project.repoId),
      ...state.issues.map((issue) => issue.repoId)
    ])
    ids.delete(state.managerRepoId ?? '')
    return repos.filter((repo) => ids.has(repo.id))
  }, [repos, state.projects, state.issues, state.managerRepoId])
  const selected = useMemo<ReadonlySet<string>>(
    () => new Set(prefs.projects ?? projectRepos.map((repo) => repo.id)),
    [prefs.projects, projectRepos]
  )
  const updatePrefs = (next: BoardPrefs): void => {
    setPrefs(next)
    saveBoardPrefs(next)
  }
  const inTeam = (issue: AgentTeamIssue): boolean =>
    teamFilter === ALL_TEAMS || issue.teamId === teamFilter
  const visible = state.issues.filter(
    (issue) => inTeam(issue) && (prefs.projects === null || selected.has(issue.repoId))
  )
  const columns = boardColumns(state, teamFilter, visible)
  const globalQueue = boardColumns(state, ALL_TEAMS, state.issues).find(
    (column) => column.kind === 'queue'
  )
  const queueIds = globalQueue?.issues.map((issue) => issue.id) ?? []
  const repoOf = (repoId: string): Repo | undefined => repos.find((repo) => repo.id === repoId)
  const nameOf = (repoId: string): string => repoOf(repoId)?.displayName ?? repoId

  const reorder = (ids: string[]): void => void run({ kind: 'queue.reorder', issueIds: ids })
  const move = (issue: AgentTeamIssue, direction: -1 | 1): void => {
    const ids = [...queueIds]
    const from = ids.indexOf(issue.id)
    const to = from + direction
    if (from !== -1 && to >= 0 && to < ids.length) {
      ids.splice(to, 0, ...ids.splice(from, 1))
      reorder(ids)
    }
  }
  const dropBefore = (targetId: string): void => {
    if (drag && drag.id !== targetId) {
      const ids = queueIds.filter((id) => id !== drag.id)
      ids.splice(Math.max(0, ids.indexOf(targetId)), 0, drag.id)
      reorder(ids)
    }
    setDrag(null)
  }

  if (state.teams.length === 0) {
    return <TeamBoardNoTeams onOpenSettings={onOpenSettings} />
  }

  const dragHandlers = (issue: AgentTeamIssue) => ({
    onDragStart: (event: React.DragEvent) => {
      event.dataTransfer.effectAllowed = 'move'
      setDrag({ id: issue.id, over: null })
    },
    onDragOver: (event: React.DragEvent) => {
      if (drag) {
        event.preventDefault()
        if (drag.over !== issue.id) {
          setDrag({ ...drag, over: issue.id })
        }
      }
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault()
      dropBefore(issue.id)
    },
    dropTarget: drag?.over === issue.id && drag.id !== issue.id
  })

  const renderCards = (
    column: BoardColumn,
    issues: AgentTeamIssue[],
    lane: boolean
  ): React.ReactNode => {
    if (column.kind === 'done' && !doneOpen) {
      return null
    }
    const shown = column.kind === 'done' ? issues.slice(0, DONE_SHOWN) : issues
    if (shown.length === 0) {
      return lane || !column.empty ? (
        <div className="h-9 rounded-lg border border-dashed border-border" />
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
          {column.empty}
        </p>
      )
    }
    return shown.map((issue) => {
      const queued = column.kind === 'queue'
      return (
        <TeamIssueCard
          key={issue.id}
          issue={issue}
          state={state}
          repo={repoOf(issue.repoId)}
          projectName={nameOf(issue.repoId)}
          hideProject={lane}
          now={now}
          position={queued ? queueIds.indexOf(issue.id) + 1 : undefined}
          waitReason={queued ? waiting[issue.id] : undefined}
          onApprove={
            column.kind === 'registered'
              ? () => void run({ kind: 'issue.approve', issueIds: [issue.id] })
              : undefined
          }
          onMove={queued ? (direction) => move(issue, direction) : undefined}
          drag={queued ? dragHandlers(issue) : undefined}
          onOpen={(target) => setSheetId(target.id)}
        />
      )
    })
  }

  const gridTemplate = columns
    .map((column) => (column.kind === 'done' && !doneOpen ? '2.5rem' : 'minmax(200px, 1fr)'))
    .join(' ')
  const header = (
    <div className="grid gap-3" style={{ gridTemplateColumns: gridTemplate }}>
      {columns.map((column) =>
        column.kind === 'done' ? (
          <button
            key={column.id}
            type="button"
            aria-expanded={doneOpen}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-3.5',
              !doneOpen && 'py-2 [writing-mode:vertical-rl]'
            )}
            onClick={() => setDoneOpen((value) => !value)}
          >
            <CircleCheck className="text-status-success" />
            {translate('auto.components.agentTeam.TeamBoard.doneCount', 'Done · {{count}}', {
              count: column.issues.length
            })}
          </button>
        ) : (
          <div key={column.id} className="flex flex-col gap-0.5">
            <h3
              className={cn(
                'flex items-center gap-2 text-xs font-semibold text-muted-foreground',
                column.kind === 'needs-you' && 'text-agent-question-text'
              )}
            >
              {column.title}
              <span className="font-normal">{column.issues.length}</span>
            </h3>
            {column.kind === 'queue' ? (
              <span className="text-2xs text-muted-foreground">
                {translate(
                  'auto.components.agentTeam.TeamBoard.queueHint',
                  'Set by the Manager · drag to reorder'
                )}
              </span>
            ) : null}
          </div>
        )
      )}
    </div>
  )

  const laneProjects = projectRepos.filter(
    (repo) => selected.has(repo.id) && visible.some((issue) => issue.repoId === repo.id)
  )
  const hidden = projectRepos.flatMap((repo) => {
    const count = state.issues.filter(
      (issue) =>
        issue.repoId === repo.id &&
        inTeam(issue) &&
        issue.status !== 'done' &&
        issue.status !== 'discarded'
    ).length
    return !selected.has(repo.id) && count > 0 ? [{ repo, count }] : []
  })
  const todayByProject = usageBy(state, 'project', lastDaysRange(1, now), now)

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <TeamLaunchFailures state={state} onOpenSettings={onOpenSettings} />
      <TeamSeatStrip state={state} now={now} onOpenIssue={setSheetId} />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger
            size="sm"
            className="min-w-40"
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
        {projectRepos.length > 1 ? (
          <RepoMultiCombobox
            repos={projectRepos}
            selected={selected}
            onChange={(next) => updatePrefs({ ...prefs, projects: [...next] })}
            onSelectAll={() => updatePrefs({ ...prefs, projects: null })}
            getRepoHostLabel={(repo) => {
              const tracker = projectTracker(
                state.projects.find((project) => project.repoId === repo.id),
                repo
              )
              return tracker ? trackerLabel(tracker.provider) : null
            }}
            triggerClassName="h-8 min-w-44"
          />
        ) : null}
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {translate('auto.components.agentTeam.TeamBoard.group', 'Group')}
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={prefs.groupByProject ? 'project' : 'none'}
            onValueChange={(value) =>
              value && updatePrefs({ ...prefs, groupByProject: value === 'project' })
            }
          >
            <ToggleGroupItem value="none">
              {translate('auto.components.agentTeam.TeamBoard.groupNone', 'None')}
            </ToggleGroupItem>
            <ToggleGroupItem value="project">
              {translate('auto.components.agentTeam.TeamBoard.groupProject', 'By project')}
            </ToggleGroupItem>
          </ToggleGroup>
        </span>
        <TeamTrackerSyncStatus state={state} now={now} />
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setCreating(true)}>
          <Plus />
          {translate('auto.components.agentTeam.TeamBoard.newIssue', 'New issue')}
        </Button>
      </div>
      <TeamPausedNotice state={state} teamFilter={teamFilter} />
      {visible.length === 0 ? (
        <TeamBoardNoIssues onOpenSettings={onOpenSettings} onOpenManager={onOpenManager} />
      ) : (
        <div className="flex flex-col gap-2">
          {header}
          {prefs.groupByProject ? (
            laneProjects.map((repo) => (
              <TeamBoardLane
                key={repo.id}
                repo={repo}
                state={state}
                columns={columns}
                gridTemplate={gridTemplate}
                open={
                  visible.filter(
                    (issue) =>
                      issue.repoId === repo.id &&
                      issue.status !== 'done' &&
                      issue.status !== 'discarded'
                  ).length
                }
                today={todayByProject.get(repo.id)}
                collapsed={collapsed.has(repo.id)}
                onToggle={() => {
                  const next = new Set(collapsed)
                  if (!next.delete(repo.id)) {
                    next.add(repo.id)
                  }
                  setCollapsed(next)
                }}
                renderCards={renderCards}
              />
            ))
          ) : (
            <div className="grid min-h-0 gap-3" style={{ gridTemplateColumns: gridTemplate }}>
              {columns.map((column) => (
                <section
                  key={column.id}
                  aria-label={column.title}
                  className="flex min-w-0 flex-col gap-2"
                >
                  {renderCards(column, column.issues, false)}
                </section>
              ))}
            </div>
          )}
        </div>
      )}
      {hidden.map(({ repo, count }) => (
        <div
          key={repo.id}
          className="flex h-10 items-center gap-2 rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground"
        >
          <TeamProjectAvatar repo={repo} name={repo.displayName} />
          {translate(
            'auto.components.agentTeam.TeamBoard.hiddenByFilter',
            '{{project}} · {{count}} issues hidden by the project filter',
            { project: repo.displayName, count }
          )}
          <Button
            size="xs"
            variant="ghost"
            className="ml-auto"
            onClick={() => updatePrefs({ ...prefs, projects: [...selected, repo.id] })}
          >
            {translate('auto.components.agentTeam.TeamBoard.show', 'Show')}
          </Button>
        </div>
      ))}
      <TeamNewIssueDialog
        open={creating}
        onOpenChange={setCreating}
        state={state}
        defaultTeamId={teamFilter === ALL_TEAMS ? state.teams[0]?.id : teamFilter}
      />
      <TeamIssueSheet issueId={sheetId} state={state} onClose={() => setSheetId(null)} />
    </div>
  )
}
