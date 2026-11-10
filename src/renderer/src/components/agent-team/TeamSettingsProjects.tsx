import { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { TASK_PROVIDERS } from '../../../../shared/work-items/task-providers'
import { getRepoRoutingConnectionId } from '../../../../shared/execution-host'
import { effectiveProjectSpecStorage } from '../../../../shared/agent-team/agent-team-spec-storage'
import { TeamProjectSpecEditor } from './TeamProjectSpecEditor'
import { TeamPromptPreview } from './TeamPromptPreview'
import { trackerLabel } from './team-labels'
import { useAgentTeamCommand } from './use-agent-team-state'

const NO_TRACKER = 'none'

export function TeamSettingsProjects({ state }: { state: AgentTeamState }): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const run = useAgentTeamCommand()
  const teamRepos = repos.filter((repo) => repo.id !== state.managerRepoId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [specForPreview, setSpecForPreview] = useState<string | null>(null)
  const repo = teamRepos.find((candidate) => candidate.id === selectedId) ?? teamRepos[0]
  const project = repo
    ? state.projects.find((candidate) => candidate.repoId === repo.id)
    : undefined

  useEffect(() => {
    if (!repo) {
      return
    }
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
    <div className="grid min-h-0 grid-cols-[240px_minmax(0,1fr)] gap-5">
      <section className="flex flex-col gap-1">
        <h2 className="mb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {translate('auto.components.agentTeam.TeamSettingsProjects.projects', 'Projects')}
        </h2>
        {teamRepos.map((candidate) => {
          const tracker = state.projects.find((entry) => entry.repoId === candidate.id)?.tracker
          return (
            <button
              key={candidate.id}
              type="button"
              data-current={candidate.id === repo?.id ? 'true' : undefined}
              onClick={() => setSelectedId(candidate.id)}
              className={cn(
                'rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent',
                candidate.id === repo?.id && 'bg-accent'
              )}
            >
              <span className="block truncate font-medium">{candidate.displayName}</span>
              <span className="block text-2xs text-muted-foreground">
                {tracker
                  ? trackerLabel(tracker.provider)
                  : translate(
                      'auto.components.agentTeam.TeamSettingsProjects.noTracker',
                      'No tracker linked'
                    )}
              </span>
            </button>
          )
        })}
        <p className="mt-2 text-xs text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamSettingsProjects.foldersHint',
            'Folder projects have no git worktrees: their issues run one at a time, directly in the folder.'
          )}
        </p>
      </section>
      {repo ? (
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <h2 className="mr-auto text-base font-semibold">{repo.displayName}</h2>
            <div className="flex flex-col gap-1.5">
              <Label>
                {translate('auto.components.agentTeam.TeamSettingsProjects.tracker', 'Tracker')}
              </Label>
              <Select
                value={project?.tracker?.provider ?? NO_TRACKER}
                onValueChange={(value) => {
                  const provider = TASK_PROVIDERS.find((candidate) => candidate === value)
                  void run({
                    kind: 'project.update',
                    repoId: repo.id,
                    patch: {
                      tracker: provider
                        ? { provider, projectKey: project?.tracker?.projectKey }
                        : undefined
                    }
                  })
                }}
              >
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TRACKER}>
                    {translate('auto.components.agentTeam.TeamSettingsProjects.none', 'None')}
                  </SelectItem>
                  {TASK_PROVIDERS.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {trackerLabel(provider)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {project?.tracker &&
            (project.tracker.provider === 'jira' || project.tracker.provider === 'linear') ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-team-project-key">
                  {translate(
                    'auto.components.agentTeam.TeamSettingsProjects.projectKey',
                    'Project or team key'
                  )}
                </Label>
                <Input
                  id="agent-team-project-key"
                  key={`${repo.id}:${project.tracker.projectKey ?? ''}`}
                  defaultValue={project.tracker.projectKey ?? ''}
                  className="h-8 w-32"
                  onBlur={(event) => {
                    const tracker = project.tracker
                    if (tracker && event.target.value !== (tracker.projectKey ?? '')) {
                      void run({
                        kind: 'project.update',
                        repoId: repo.id,
                        patch: {
                          tracker: {
                            ...tracker,
                            projectKey: event.target.value.trim() || undefined
                          }
                        }
                      })
                    }
                  }}
                />
              </div>
            ) : null}
            {repo.kind === 'folder' ? null : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-team-base-branch">
                  {translate(
                    'auto.components.agentTeam.TeamSettingsProjects.baseBranch',
                    'Base branch'
                  )}
                </Label>
                <Input
                  id="agent-team-base-branch"
                  key={`${repo.id}:${project?.baseBranch ?? ''}`}
                  defaultValue={project?.baseBranch ?? ''}
                  placeholder={translate(
                    'auto.components.agentTeam.TeamSettingsProjects.baseBranchDefault',
                    'Project default'
                  )}
                  className="h-8 w-40"
                  onBlur={(event) => {
                    const next = event.target.value.trim()
                    if (next !== (project?.baseBranch ?? '')) {
                      void run({
                        kind: 'project.update',
                        repoId: repo.id,
                        patch: { baseBranch: next || undefined }
                      })
                    }
                  }}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label>
                {translate(
                  'auto.components.agentTeam.TeamSettingsProjects.storage',
                  'Spec saved in'
                )}
              </Label>
              <ToggleGroup
                type="single"
                size="sm"
                variant="outline"
                value={effectiveProjectSpecStorage(project, repo)}
                disabled={getRepoRoutingConnectionId(repo) !== null}
                onValueChange={(value) => {
                  if (value === 'repository' || value === 'local') {
                    void run({
                      kind: 'project.update',
                      repoId: repo.id,
                      patch: { specStorage: value }
                    })
                  }
                }}
              >
                <ToggleGroupItem value="repository">
                  {translate(
                    'auto.components.agentTeam.TeamSettingsProjects.repository',
                    'Repository · .orca/agent-team.md'
                  )}
                </ToggleGroupItem>
                <ToggleGroupItem value="local">
                  {translate(
                    'auto.components.agentTeam.TeamSettingsProjects.local',
                    'This computer'
                  )}
                </ToggleGroupItem>
              </ToggleGroup>
              {getRepoRoutingConnectionId(repo) !== null ? (
                <span className="text-xs text-muted-foreground">
                  {translate(
                    'auto.components.agentTeam.TeamSettingsProjects.remoteStorageHint',
                    'Remote project: its spec is kept on this computer, because Orca cannot read the remote checkout from here yet.'
                  )}
                </span>
              ) : null}
            </div>
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
