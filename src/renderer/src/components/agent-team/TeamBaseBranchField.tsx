import { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import {
  getRuntimeRepoBaseRefDefault,
  searchRuntimeRepoBaseRefs
} from '@/runtime/source-control/references/runtime-repo-client'
import type { Repo } from '../../../../shared/repo-types'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { normalizeHostedReviewBaseRef } from '../../../../shared/source-control/hosted-review/hosted-review-refs'
import { TeamFieldRow } from './TeamFieldRow'

/** The repo's default branch, so an empty base branch shows what it falls back to. */
function useRepoDefaultBranch(repo: Repo): string | null {
  const [branch, setBranch] = useState<{ repoId: string; name: string | null } | null>(null)
  useEffect(() => {
    let stale = false
    void getRuntimeRepoBaseRefDefault(getRepoExecutionHostId(repo), repo.id)
      .then((result) => {
        if (!stale) {
          setBranch({
            repoId: repo.id,
            name: result.defaultBaseRef ? normalizeHostedReviewBaseRef(result.defaultBaseRef) : null
          })
        }
      })
      .catch(() => undefined)
    return () => {
      stale = true
    }
  }, [repo])
  return branch?.repoId === repo.id ? branch.name : null
}

/** Whether a typed base branch exists, so a typo shows before work starts from it. */
function useBranchExists(repo: Repo, name: string): boolean | null {
  const [found, setFound] = useState<{ key: string; exists: boolean } | null>(null)
  const key = `${repo.id}:${name}`
  useEffect(() => {
    if (!name) {
      return
    }
    let stale = false
    void searchRuntimeRepoBaseRefs(getRepoExecutionHostId(repo), repo.id, name, 20)
      .then((refs) => {
        if (!stale) {
          const exists = refs.some((ref) => normalizeHostedReviewBaseRef(ref) === name)
          setFound({ key: `${repo.id}:${name}`, exists })
        }
      })
      .catch(() => undefined)
    return () => {
      stale = true
    }
  }, [repo, name])
  return name && found?.key === key ? found.exists : null
}

export function TeamBaseBranchField({
  repo,
  value,
  onCommit
}: {
  repo: Repo
  value: string
  onCommit: (next: string) => void
}): React.JSX.Element {
  const defaultBranch = useRepoDefaultBranch(repo)
  const exists = useBranchExists(repo, value)
  return (
    <TeamFieldRow
      id="agent-team-base-branch"
      label={translate('auto.components.agentTeam.TeamSettingsProjects.baseBranch', 'Base branch')}
      error={exists === false}
      hint={
        exists === false
          ? translate(
              'auto.components.agentTeam.TeamSettingsProjects.baseBranchMissing',
              'No branch {{branch}} in this repo.',
              { branch: value }
            )
          : defaultBranch
            ? translate(
                'auto.components.agentTeam.TeamSettingsProjects.repoDefaultBranch',
                'Repo default: {{branch}}',
                { branch: defaultBranch }
              )
            : undefined
      }
    >
      <Input
        id="agent-team-base-branch"
        key={`${repo.id}:${value}`}
        defaultValue={value}
        placeholder={
          defaultBranch
            ? translate(
                'auto.components.agentTeam.TeamSettingsProjects.baseBranchDefaultNamed',
                'Default ({{branch}})',
                { branch: defaultBranch }
              )
            : translate(
                'auto.components.agentTeam.TeamSettingsProjects.baseBranchDefault',
                'Project default'
              )
        }
        aria-invalid={exists === false || undefined}
        className="h-8 w-full font-mono text-xs"
        onBlur={(event) => {
          const next = event.target.value.trim()
          if (next !== value) {
            onCommit(next)
          }
        }}
      />
    </TeamFieldRow>
  )
}
