import { useEffect, useState } from 'react'
import { FolderTree } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'
import { effectiveProjectSpecStorage } from '../../../../shared/agent-team/agent-team-spec-storage'
import { getFolderSourceRepos } from '../../../../shared/folder-workspaces/folder-workspace-source-repos'
import { projectTracker } from '../../../../shared/agent-team/agent-team-project-tracker'
import { TeamGroupSettings } from './TeamGroupSettings'
import { TeamProjectFields } from './TeamProjectFields'
import { TeamProjectSpecEditor } from './TeamProjectSpecEditor'
import { TeamPromptPreview } from './TeamPromptPreview'
import { trackerLabel } from './team-labels'

type Selection = { kind: 'group' | 'repo'; id: string }

function TrackerHint({ state, repo }: { state: AgentTeamState; repo: Repo }): React.JSX.Element {
  const tracker = projectTracker(
    state.projects.find((entry) => entry.repoId === repo.id),
    repo
  )
  return (
    <span className="block text-2xs text-muted-foreground">
      {tracker
        ? trackerLabel(tracker.provider)
        : translate(
            'auto.components.agentTeam.TeamSettingsProjects.noTracker',
            'No tracker linked'
          )}
    </span>
  )
}

function ListButton({
  current,
  onClick,
  children
}: {
  current: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      data-current={current ? 'true' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent',
        current && 'bg-accent'
      )}
    >
      {children}
    </button>
  )
}

/** The tracker, base branch and spec of one repo, with the prompt its seats get. */
function ProjectDetail({ state, repo }: { state: AgentTeamState; repo: Repo }): React.JSX.Element {
  const project = state.projects.find((candidate) => candidate.repoId === repo.id)
  const [specForPreview, setSpecForPreview] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void window.api.agentTeam.readProjectSpec(repo.id).then((read) => {
      if (!cancelled) {
        setSpecForPreview(read.text || null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [repo, project?.specStorage, project?.localSpec])
  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <TeamProjectFields repo={repo} project={project} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <TeamProjectSpecEditor
          key={repo.id}
          repoId={repo.id}
          storage={effectiveProjectSpecStorage(project, repo)}
        />
        <TeamPromptPreview
          state={state}
          specText={specForPreview}
          delivery={{
            folder: repo.kind === 'folder',
            baseBranch: project?.baseBranch?.trim() || null
          }}
        />
      </div>
    </>
  )
}

export function TeamSettingsProjects({ state }: { state: AgentTeamState }): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const projectGroups = useAppStore((s) => s.projectGroups)
  const teamRepos = repos.filter((repo) => repo.id !== state.managerRepoId)
  // Orca groups with at least two git repos can be worked as one project.
  const groups = projectGroups.flatMap((group) => {
    const members = getFolderSourceRepos(teamRepos, projectGroups, group)
    return members.length > 1 ? [{ group, members }] : []
  })
  const grouped = new Set((state.groups ?? []).flatMap((group) => group.repoIds))
  const soloRepos = teamRepos.filter((repo) => !grouped.has(repo.id))
  const [selection, setSelection] = useState<Selection | null>(null)
  const selectedGroup =
    selection?.kind === 'group'
      ? groups.find((entry) => entry.group.id === selection.id)
      : undefined
  const selectedRepo =
    selection?.kind === 'repo'
      ? soloRepos.find((repo) => repo.id === selection.id)
      : selectedGroup
        ? undefined
        : soloRepos[0]
  const fallbackGroup = !selectedRepo && !selectedGroup ? groups[0] : undefined
  const activeGroup = selectedGroup ?? fallbackGroup

  return (
    <div className="grid min-h-0 grid-cols-[240px_minmax(0,1fr)] gap-5">
      <section className="flex flex-col gap-1">
        {groups.length > 0 ? (
          <>
            <h2 className="mb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              {translate('auto.components.agentTeam.TeamSettingsProjects.groups', 'Project groups')}
            </h2>
            {groups.map(({ group, members }) => (
              <GroupListEntry
                key={group.id}
                group={group}
                members={members}
                state={state}
                current={activeGroup?.group.id === group.id}
                onClick={() => setSelection({ kind: 'group', id: group.id })}
              />
            ))}
          </>
        ) : null}
        <h2 className="mb-1 mt-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {translate('auto.components.agentTeam.TeamSettingsProjects.projects', 'Projects')}
        </h2>
        {soloRepos.map((candidate) => (
          <ListButton
            key={candidate.id}
            current={candidate.id === selectedRepo?.id}
            onClick={() => setSelection({ kind: 'repo', id: candidate.id })}
          >
            <span className="block truncate font-medium">{candidate.displayName}</span>
            <TrackerHint state={state} repo={candidate} />
          </ListButton>
        ))}
        <p className="mt-2 text-xs text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamSettingsProjects.foldersHint',
            'Folder projects have no git worktrees: their issues run one at a time, directly in the folder.'
          )}
        </p>
      </section>
      {activeGroup ? (
        <GroupDetail state={state} group={activeGroup.group} members={activeGroup.members} />
      ) : selectedRepo ? (
        <section className="flex min-w-0 flex-col gap-4">
          <h2 className="text-base font-semibold">{selectedRepo.displayName}</h2>
          <ProjectDetail state={state} repo={selectedRepo} />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamSettingsProjects.noProjects',
            'Add a git project to Orca to use it with a team.'
          )}
        </p>
      )}
    </div>
  )
}

function GroupListEntry({
  group,
  members,
  state,
  current,
  onClick
}: {
  group: ProjectGroup
  members: Repo[]
  state: AgentTeamState
  current: boolean
  onClick: () => void
}): React.JSX.Element {
  const teamGroup = state.groups?.find((candidate) => candidate.groupId === group.id)
  const trackerRepo = members.find((repo) => repo.id === teamGroup?.trackerRepoId)
  return (
    <ListButton current={current} onClick={onClick}>
      <span className="flex items-center gap-1.5 truncate font-medium">
        <FolderTree className="size-3.5 shrink-0 text-muted-foreground" />
        {group.name}
      </span>
      {trackerRepo ? (
        <TrackerHint state={state} repo={trackerRepo} />
      ) : (
        <span className="block text-2xs text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamSettingsProjects.groupRepos',
            '{{count}} repos · separate projects',
            { count: members.length }
          )}
        </span>
      )}
    </ListButton>
  )
}

function GroupDetail({
  state,
  group,
  members
}: {
  state: AgentTeamState
  group: ProjectGroup
  members: Repo[]
}): React.JSX.Element {
  const teamGroup = state.groups?.find((candidate) => candidate.groupId === group.id)
  const trackerRepo = members.find((repo) => repo.id === teamGroup?.trackerRepoId)
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h2 className="text-base font-semibold">{group.name}</h2>
      <TeamGroupSettings group={group} repos={members} teamGroup={teamGroup} />
      {trackerRepo ? <ProjectDetail state={state} repo={trackerRepo} /> : null}
    </section>
  )
}
