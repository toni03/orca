import { useEffect, useState } from 'react'
import { FileDiff } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { getConnectionId } from '@/lib/workspace/ownership/connection-context'
import { detectLanguage } from '../../../../shared/editor-language/editor-language-detect'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { getRuntimeGitBranchCompare } from '@/runtime/source-control/git/runtime-git-diff-client'
import { findWorktreeById } from '@/store/github/refresh/worktree-refresh'
import {
  getWorktreeGitOwnerTarget,
  requireGitOwnerTarget
} from '@/components/right-sidebar/source-control/sync/worktree-git-owner-target'
import type { GitBranchCompareResult } from '../../../../shared/git/diff/git-diff-compare-types'
import type { AgentTeamIssue, AgentTeamState } from '../../../../shared/agent-team/agent-team-types'

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; result: GitBranchCompareResult; baseRef: string; worktreePath: string }
  | { kind: 'unavailable'; reason: string }

/** Lines added and removed across the branch, as the sheet header shows them. */
export function changeTotals(result: GitBranchCompareResult): { added: number; removed: number } {
  return result.entries.reduce(
    (totals, entry) => ({
      added: totals.added + (entry.added ?? 0),
      removed: totals.removed + (entry.removed ?? 0)
    }),
    { added: 0, removed: 0 }
  )
}

/** Compares the issue branch with its base, the same way Source Control does. */
export function useIssueBranchChanges(issue: AgentTeamIssue, state: AgentTeamState): Load {
  const worktree = useAppStore((s) =>
    issue.worktreeId ? findWorktreeById(s, issue.worktreeId) : null
  )
  const repos = useAppStore((s) => s.repos)
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const repo = repos.find((candidate) => candidate.id === issue.repoId)
  const project = state.projects.find((candidate) => candidate.repoId === issue.repoId)
  const baseRef =
    worktree?.baseRef?.trim() || repo?.worktreeBaseRef?.trim() || project?.baseBranch?.trim() || ''
  const worktreeId = worktree?.id
  const worktreePath = worktree?.path

  useEffect(() => {
    if (!worktreeId || !worktreePath) {
      setLoad({
        kind: 'unavailable',
        reason: translate(
          'auto.components.agentTeam.TeamIssueChanges.noWorktree',
          'This issue has no worktree open, so there is nothing to compare.'
        )
      })
      return
    }
    if (!baseRef) {
      setLoad({
        kind: 'unavailable',
        reason: translate(
          'auto.components.agentTeam.TeamIssueChanges.noBase',
          'Set the base branch in Settings › Team › Projects to compare this branch.'
        )
      })
      return
    }
    let cancelled = false
    setLoad({ kind: 'loading' })
    getRuntimeGitBranchCompare(
      {
        target: requireGitOwnerTarget(getWorktreeGitOwnerTarget(worktreeId)),
        worktreeId,
        worktreePath,
        connectionId: getConnectionId(worktreeId) ?? undefined
      },
      baseRef
    )
      .then((result) => {
        if (!cancelled) {
          setLoad(
            result.summary.status === 'ready'
              ? { kind: 'ready', result, baseRef, worktreePath }
              : {
                  kind: 'unavailable',
                  reason: result.summary.errorMessage ?? result.summary.status
                }
          )
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoad({
            kind: 'unavailable',
            reason: error instanceof Error ? error.message : String(error)
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [worktreeId, worktreePath, baseRef])
  return load
}

/** Files the branch changed against its base; each opens its diff in the worktree. */
export function TeamIssueChanges({
  issue,
  load,
  onOpened
}: {
  issue: AgentTeamIssue
  load: Load
  onOpened: () => void
}): React.JSX.Element {
  const openBranchDiff = useAppStore((s) => s.openBranchDiff)
  const openBranchAllDiffs = useAppStore((s) => s.openBranchAllDiffs)
  const beginCompare = useAppStore((s) => s.beginGitBranchCompareRequest)
  const setCompareResult = useAppStore((s) => s.setGitBranchCompareResult)

  if (load.kind === 'loading') {
    return (
      <p className="text-sm text-muted-foreground">
        {translate('auto.components.agentTeam.TeamIssueChanges.loading', 'Comparing the branch…')}
      </p>
    )
  }
  if (load.kind === 'unavailable') {
    return <p className="text-sm text-muted-foreground">{load.reason}</p>
  }
  const worktreeId = issue.worktreeId
  const { result, baseRef, worktreePath } = load
  // Diff tabs read the compare from the store, as Source Control leaves it.
  const prime = (): void => {
    if (worktreeId) {
      const requestKey = `${worktreeId}:${baseRef}:${Date.now()}:agent-team`
      beginCompare(worktreeId, requestKey, baseRef)
      setCompareResult(worktreeId, requestKey, result)
      activateAndRevealWorktree(worktreeId)
    }
  }
  const totals = changeTotals(result)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {translate(
            'auto.components.agentTeam.TeamIssueChanges.summary',
            '{{files}} files against {{base}}',
            { files: result.summary.changedFiles, base: baseRef }
          )}
        </span>
        <span className="font-mono">
          <span className="text-status-success">+{totals.added}</span>{' '}
          <span className="text-destructive">−{totals.removed}</span>
        </span>
        {worktreeId && result.entries.length > 0 ? (
          <Button
            size="xs"
            variant="outline"
            className="ml-auto"
            onClick={() => {
              prime()
              openBranchAllDiffs(worktreeId, worktreePath, result.summary)
              onOpened()
            }}
          >
            <FileDiff />
            {translate('auto.components.agentTeam.TeamIssueChanges.viewAll', 'Open the full diff')}
          </Button>
        ) : null}
      </div>
      {result.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate('auto.components.agentTeam.TeamIssueChanges.none', 'No changes yet.')}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border/60">
          {result.entries.map((entry) => (
            <li key={entry.path} className="border-t border-border/60 first:border-t-0">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                onClick={() => {
                  if (worktreeId) {
                    prime()
                    openBranchDiff(
                      worktreeId,
                      worktreePath,
                      entry,
                      result.summary,
                      detectLanguage(entry.path)
                    )
                    onOpened()
                  }
                }}
              >
                <span className="truncate font-mono">{entry.path}</span>
                <span className="ml-auto shrink-0 font-mono">
                  <span className="text-status-success">+{entry.added ?? 0}</span>{' '}
                  <span className="text-destructive">−{entry.removed ?? 0}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
