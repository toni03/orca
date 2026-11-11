import { translate } from '@/i18n/i18n'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'
import type { AgentTeamProjectGroup } from '../../../../shared/agent-team/agent-team-types'
import { projectTracker } from '../../../../shared/agent-team/agent-team-project-tracker'
import { useAgentTeamCommand } from './use-agent-team-state'

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
    <div className="flex max-w-2xl flex-col gap-4">
      <label className="flex items-center justify-between gap-3 text-sm">
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
          <div className="flex flex-col gap-1.5">
            <Label>
              {translate('auto.components.agentTeam.TeamGroupSettings.trackerRepo', 'Tracker repo')}
            </Label>
            <Select
              value={teamGroup.trackerRepoId}
              onValueChange={(trackerRepoId) =>
                save({
                  ...teamGroup,
                  trackerRepoId,
                  repoIds: [...new Set([...teamGroup.repoIds, trackerRepoId])]
                })
              }
            >
              <SelectTrigger size="sm" className="w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {repos.map((repo) => (
                  <SelectItem key={repo.id} value={repo.id}>
                    {repo.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {translate(
                'auto.components.agentTeam.TeamGroupSettings.trackerRepoHint',
                'Holds the group tracker, spec and base branch; the agent starts in its worktree.'
              )}
            </span>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              {translate('auto.components.agentTeam.TeamGroupSettings.repos', 'Repos')}
            </legend>
            {repos.map((repo) => {
              const isTracker = repo.id === teamGroup.trackerRepoId
              return (
                <label key={repo.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={teamGroup.repoIds.includes(repo.id)}
                    disabled={isTracker}
                    onCheckedChange={(checked) =>
                      save({
                        ...teamGroup,
                        repoIds:
                          checked === true
                            ? [...teamGroup.repoIds, repo.id]
                            : teamGroup.repoIds.filter((id) => id !== repo.id)
                      })
                    }
                  />
                  <span>{repo.displayName}</span>
                  {isTracker ? (
                    <span className="text-xs text-muted-foreground">
                      {translate(
                        'auto.components.agentTeam.TeamGroupSettings.trackerTag',
                        'tracker'
                      )}
                    </span>
                  ) : null}
                </label>
              )
            })}
          </fieldset>
        </>
      ) : null}
    </div>
  )
}
