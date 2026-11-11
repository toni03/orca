import { translate } from '@/i18n/i18n'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'
import type { AgentTeamProjectGroup } from '../../../../shared/agent-team/agent-team-types'
import { projectTracker } from '../../../../shared/agent-team/agent-team-project-tracker'
import { trackerLabel } from './team-labels'
import { useAgentTeamCommand } from './use-agent-team-state'

const ROW =
  'grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center border-t border-border px-3.5'

function RepoRow({
  repo,
  teamGroup,
  onSave
}: {
  repo: Repo
  teamGroup: AgentTeamProjectGroup
  onSave: (next: AgentTeamProjectGroup) => void
}): React.JSX.Element {
  const isTracker = repo.id === teamGroup.trackerRepoId
  const tracker = projectTracker(undefined, repo)
  return (
    <div className={`${ROW} py-2.5`}>
      <span className="min-w-0 truncate text-sm">
        <span className="font-medium">{repo.displayName}</span>
        {tracker ? (
          <span className="text-xs text-muted-foreground"> · {trackerLabel(tracker.provider)}</span>
        ) : null}
      </span>
      <span className="flex justify-center">
        <Checkbox
          checked={teamGroup.repoIds.includes(repo.id)}
          disabled={isTracker}
          aria-label={translate(
            'auto.components.agentTeam.TeamGroupSettings.include',
            'Include {{repo}}',
            { repo: repo.displayName }
          )}
          onCheckedChange={(checked) =>
            onSave({
              ...teamGroup,
              repoIds:
                checked === true
                  ? [...teamGroup.repoIds, repo.id]
                  : teamGroup.repoIds.filter((id) => id !== repo.id)
            })
          }
        />
      </span>
      <span className="flex justify-center">
        <RadioGroupItem
          value={repo.id}
          aria-label={translate(
            'auto.components.agentTeam.TeamGroupSettings.trackerIn',
            'Tracker in {{repo}}',
            { repo: repo.displayName }
          )}
        />
      </span>
    </div>
  )
}

/** Turns an Orca project group into one team project: one branch and worktree per repo for each issue. */
export function TeamGroupSettings({
  group,
  repos,
  teamGroup
}: {
  group: ProjectGroup
  repos: Repo[]
  teamGroup: AgentTeamProjectGroup | undefined
}): React.JSX.Element {
  const run = useAgentTeamCommand()
  const save = (next: AgentTeamProjectGroup): void => {
    void run({ kind: 'group.update', group: next })
  }
  // The repo whose remote gives a tracker is the natural home for the group's issues.
  const suggestedTracker = repos.find((repo) => projectTracker(undefined, repo)) ?? repos[0]

  return (
    <div className="rounded-lg border border-border bg-card">
      <label className="flex items-center justify-between gap-3 px-3.5 py-3 text-sm">
        <span>
          {translate(
            'auto.components.agentTeam.TeamGroupSettings.asOne',
            'Work this group as one project'
          )}
          <span className="block text-xs text-muted-foreground">
            {translate(
              'auto.components.agentTeam.TeamGroupSettings.asOneHint',
              'Each issue gets a worktree in every selected repo, all on one branch, and a merge request in each repo it changes. Its issues and tracker live in the tracker repo.'
            )}
          </span>
        </span>
        <Switch
          checked={teamGroup !== undefined}
          disabled={!suggestedTracker}
          onCheckedChange={(checked) => {
            if (!checked) {
              void run({ kind: 'group.remove', groupId: group.id })
            } else if (suggestedTracker) {
              save({
                groupId: group.id,
                trackerRepoId: suggestedTracker.id,
                repoIds: repos.map((repo) => repo.id)
              })
            }
          }}
        />
      </label>
      {teamGroup ? (
        <>
          <div className={`${ROW} py-2 text-2xs text-muted-foreground`}>
            <span>{translate('auto.components.agentTeam.TeamGroupSettings.repos', 'Repos')}</span>
            <span className="text-center">
              {translate('auto.components.agentTeam.TeamGroupSettings.included', 'Included')}
            </span>
            <span className="text-center">
              {translate('auto.components.agentTeam.TeamGroupSettings.trackerRepo', 'Tracker repo')}
            </span>
          </div>
          <RadioGroup
            className="gap-0"
            value={teamGroup.trackerRepoId}
            onValueChange={(trackerRepoId) =>
              save({
                ...teamGroup,
                trackerRepoId,
                repoIds: [...new Set([...teamGroup.repoIds, trackerRepoId])]
              })
            }
          >
            {repos.map((repo) => (
              <RepoRow key={repo.id} repo={repo} teamGroup={teamGroup} onSave={save} />
            ))}
          </RadioGroup>
          <p className="border-t border-border px-3.5 py-2.5 text-xs text-muted-foreground">
            {translate(
              'auto.components.agentTeam.TeamGroupSettings.trackerRepoHint',
              'Holds the group tracker, spec and base branch; the agent starts in its worktree.'
            )}
          </p>
        </>
      ) : null}
    </div>
  )
}
