import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useTaskSourceProviderReadiness } from '@/components/settings/tasks/use-task-source-provider-readiness'
import type { AgentTeamProject } from '../../../../shared/agent-team/agent-team-types'
import type { Repo } from '../../../../shared/repo-types'
import { TASK_PROVIDERS } from '../../../../shared/work-items/task-providers'
import { getRepoRoutingConnectionId } from '../../../../shared/execution-host'
import { effectiveProjectSpecStorage } from '../../../../shared/agent-team/agent-team-spec-storage'
import {
  projectTracker,
  trackerFromRepoRemote
} from '../../../../shared/agent-team/agent-team-project-tracker'
import { TeamBaseBranchField } from './TeamBaseBranchField'
import { TeamFieldRow } from './TeamFieldRow'
import { trackerLabel } from './team-labels'
import { useAgentTeamCommand } from './use-agent-team-state'

const NO_TRACKER = 'none'

/** Tracker, base branch and spec storage of one team project, as rows of one card. */
export function TeamProjectFields({
  repo,
  project
}: {
  repo: Repo
  project: AgentTeamProject | undefined
}): React.JSX.Element {
  const run = useAgentTeamCommand()
  const readiness = useTaskSourceProviderReadiness(TASK_PROVIDERS)
  const tracker = projectTracker(project, repo)
  const fromRemote = trackerFromRepoRemote(repo)
  // Only trackers this client can reach; the current one stays listed so it can be seen and changed.
  const providers = TASK_PROVIDERS.filter(
    (provider) =>
      readiness[provider].connected ||
      readiness[provider].checking ||
      provider === tracker?.provider
  )
  const update = (patch: Partial<Omit<AgentTeamProject, 'repoId'>>): void => {
    void run({ kind: 'project.update', repoId: repo.id, patch })
  }
  const remoteStorage = getRepoRoutingConnectionId(repo) !== null
  const trackerMissing =
    tracker !== undefined &&
    !readiness[tracker.provider].connected &&
    !readiness[tracker.provider].checking

  return (
    <div className="rounded-lg border border-border bg-card">
      <TeamFieldRow
        id="agent-team-tracker"
        label={translate('auto.components.agentTeam.TeamSettingsProjects.tracker', 'Tracker')}
        error={trackerMissing}
        hint={
          trackerMissing && tracker
            ? translate(
                'auto.components.agentTeam.TeamSettingsProjects.trackerNotConnected',
                '{{tracker}} is not connected in this Orca: connect it in Settings › Task Sources.',
                { tracker: trackerLabel(tracker.provider) }
              )
            : translate(
                'auto.components.agentTeam.TeamSettingsProjects.trackerHint',
                "Defaults to the repo's code host."
              )
        }
      >
        <Select
          value={tracker?.provider ?? NO_TRACKER}
          onValueChange={(value) => {
            const provider = TASK_PROVIDERS.find((candidate) => candidate === value)
            update({
              tracker: provider ? { provider, projectKey: tracker?.projectKey } : null
            })
          }}
        >
          <SelectTrigger
            id="agent-team-tracker"
            size="sm"
            className="w-full"
            aria-labelledby="agent-team-tracker-label"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TRACKER}>
              {translate('auto.components.agentTeam.TeamSettingsProjects.none', 'None')}
            </SelectItem>
            {providers.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {provider === fromRemote
                  ? translate(
                      'auto.components.agentTeam.TeamSettingsProjects.trackerFromRepo',
                      '{{tracker}} (repo)',
                      { tracker: trackerLabel(provider) }
                    )
                  : trackerLabel(provider)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TeamFieldRow>
      {tracker && (tracker.provider === 'jira' || tracker.provider === 'linear') ? (
        <TeamFieldRow
          id="agent-team-project-key"
          label={translate(
            'auto.components.agentTeam.TeamSettingsProjects.projectKey',
            'Project or team key'
          )}
        >
          <Input
            id="agent-team-project-key"
            key={`${repo.id}:${tracker.projectKey ?? ''}`}
            defaultValue={tracker.projectKey ?? ''}
            className="h-8 w-full"
            onBlur={(event) => {
              if (event.target.value !== (tracker.projectKey ?? '')) {
                update({
                  tracker: { ...tracker, projectKey: event.target.value.trim() || undefined }
                })
              }
            }}
          />
        </TeamFieldRow>
      ) : null}
      {repo.kind === 'folder' ? null : (
        <TeamBaseBranchField
          repo={repo}
          value={project?.baseBranch ?? ''}
          onCommit={(next) => update({ baseBranch: next || undefined })}
        />
      )}
      <TeamFieldRow
        id="agent-team-spec-storage"
        label={translate('auto.components.agentTeam.TeamSettingsProjects.storage', 'Spec saved in')}
        hint={
          remoteStorage
            ? translate(
                'auto.components.agentTeam.TeamSettingsProjects.remoteStorageHint',
                'Remote project: its spec is kept on this computer, because Orca cannot read the remote checkout from here yet.'
              )
            : translate(
                'auto.components.agentTeam.TeamSettingsProjects.storageHint',
                'In the repository it lives at .orca/agent-team.md and is shared with everyone.'
              )
        }
      >
        <ToggleGroup
          id="agent-team-spec-storage"
          type="single"
          variant="segmented-card"
          aria-labelledby="agent-team-spec-storage-label"
          value={effectiveProjectSpecStorage(project, repo)}
          disabled={remoteStorage}
          onValueChange={(value) => {
            if (value === 'repository' || value === 'local') {
              update({ specStorage: value })
            }
          }}
        >
          <ToggleGroupItem value="repository">
            {translate('auto.components.agentTeam.TeamSettingsProjects.storageRepo', 'Repository')}
          </ToggleGroupItem>
          <ToggleGroupItem value="local">
            {translate('auto.components.agentTeam.TeamSettingsProjects.local', 'This computer')}
          </ToggleGroupItem>
        </ToggleGroup>
      </TeamFieldRow>
    </div>
  )
}
