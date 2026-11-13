import { useEffect, useState } from 'react'
import { ChevronRight, FolderTree } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
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
import { sortByLabel, sortByName } from '../../../../shared/agent-team/agent-team-name-order'

const SECTION = 'text-2xs font-semibold uppercase tracking-wider text-muted-foreground'

function trackerSummary(state: AgentTeamState, repo: Repo | undefined): string {
  const tracker = repo
    ? projectTracker(
        state.projects.find((entry) => entry.repoId === repo.id),
        repo
      )
    : undefined
  return tracker
    ? trackerLabel(tracker.provider)
    : translate('auto.components.agentTeam.TeamSettingsProjects.noTracker', 'No tracker linked')
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
      <section className="flex flex-col gap-2">
        <h3 className={SECTION}>
          {translate(
            'auto.components.agentTeam.TeamSettingsProjects.trackerAndBranch',
            'Tracker and branch · {{repo}}',
            { repo: repo.displayName }
          )}
        </h3>
        <TeamProjectFields repo={repo} project={project} />
      </section>
      <TeamProjectSpecEditor
        key={repo.id}
        repoId={repo.id}
        storage={effectiveProjectSpecStorage(project, repo)}
      />
      <Collapsible className="rounded-lg border border-border bg-card">
        <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3.5 py-2.5 text-sm">
          <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
          {translate(
            'auto.components.agentTeam.TeamSettingsProjects.showPreview',
            'Prompt preview'
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border p-3.5">
          <TeamPromptPreview
            state={state}
            specText={specForPreview}
            delivery={{
              folder: repo.kind === 'folder',
              baseBranch: project?.baseBranch?.trim() || null
            }}
          />
        </CollapsibleContent>
      </Collapsible>
    </>
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
    <>
      <section className="flex flex-col gap-2">
        <h3 className={SECTION}>
          {translate('auto.components.agentTeam.TeamSettingsProjects.group', 'Group')}
        </h3>
        <TeamGroupSettings group={group} repos={members} teamGroup={teamGroup} />
      </section>
      {trackerRepo ? <ProjectDetail state={state} repo={trackerRepo} /> : null}
    </>
  )
}

function ProjectPicker({
  state,
  groups,
  soloRepos,
  value,
  onChange
}: {
  state: AgentTeamState
  groups: { group: ProjectGroup; members: Repo[] }[]
  soloRepos: Repo[]
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className="h-9 w-96 max-w-full"
        aria-label={translate(
          'auto.components.agentTeam.TeamSettingsProjects.projects',
          'Projects'
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {groups.length > 0 ? (
          <SelectGroup>
            <SelectLabel>
              {translate('auto.components.agentTeam.TeamSettingsProjects.groups', 'Project groups')}
            </SelectLabel>
            {groups.map(({ group, members }) => {
              const teamGroup = state.groups?.find((entry) => entry.groupId === group.id)
              const trackerRepo = members.find((repo) => repo.id === teamGroup?.trackerRepoId)
              return (
                <SelectItem key={group.id} value={`group:${group.id}`}>
                  <FolderTree className="text-muted-foreground" />
                  <span className="font-semibold">{group.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {trackerRepo
                      ? trackerSummary(state, trackerRepo)
                      : translate(
                          'auto.components.agentTeam.TeamSettingsProjects.groupRepos',
                          '{{count}} repos · separate projects',
                          { count: members.length }
                        )}
                  </span>
                </SelectItem>
              )
            })}
          </SelectGroup>
        ) : null}
        <SelectGroup>
          <SelectLabel>
            {translate('auto.components.agentTeam.TeamSettingsProjects.projects', 'Projects')}
          </SelectLabel>
          {soloRepos.map((repo) => (
            <SelectItem key={repo.id} value={`repo:${repo.id}`}>
              <span className="font-semibold">{repo.displayName}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {trackerSummary(state, repo)}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function TeamSettingsProjects({ state }: { state: AgentTeamState }): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const projectGroups = useAppStore((s) => s.projectGroups)
  const teamRepos = sortByLabel(
    repos.filter((repo) => repo.id !== state.managerRepoId),
    (repo) => repo.displayName
  )
  // Orca groups with at least two git repos can be worked as one project.
  const groups = sortByName(projectGroups).flatMap((group) => {
    const members = getFolderSourceRepos(teamRepos, projectGroups, group)
    return members.length > 1 ? [{ group, members }] : []
  })
  const grouped = new Set((state.groups ?? []).flatMap((group) => group.repoIds))
  const soloRepos = teamRepos.filter((repo) => !grouped.has(repo.id))
  const [selection, setSelection] = useState<string | null>(null)
  const options = [
    ...groups.map((entry) => `group:${entry.group.id}`),
    ...soloRepos.map((repo) => `repo:${repo.id}`)
  ]
  const current = selection && options.includes(selection) ? selection : options[0]
  const activeGroup = groups.find((entry) => `group:${entry.group.id}` === current)
  const activeRepo = soloRepos.find((repo) => `repo:${repo.id}` === current)

  if (!current) {
    return (
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.agentTeam.TeamSettingsProjects.noProjects',
          'Add a git project to Orca to use it with a team.'
        )}
      </p>
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-2 border-b border-border pb-4">
        <ProjectPicker
          state={state}
          groups={groups}
          soloRepos={soloRepos}
          value={current}
          onChange={setSelection}
        />
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamSettingsProjects.foldersHint',
            'Folder projects have no git worktrees: their issues run one at a time, directly in the folder.'
          )}
        </p>
      </div>
      {activeGroup ? (
        <GroupDetail state={state} group={activeGroup.group} members={activeGroup.members} />
      ) : activeRepo ? (
        <ProjectDetail state={state} repo={activeRepo} />
      ) : null}
    </div>
  )
}
