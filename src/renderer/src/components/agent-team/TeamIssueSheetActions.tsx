import { useEffect, useState } from 'react'
import { Check, GitBranch, Link2, Pause, Trash2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { openAssignment } from '../../../../shared/agent-team/agent-team-pipeline'
import type { AgentTeamIssueLiveStatus } from '../../../../shared/agent-team/agent-team-ipc'
import type { AgentTeamIssue, AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { issueKey, isMergeRequestUrl } from './team-labels'
import { useAgentTeamCommand } from './use-agent-team-state'

/** Reads the tracker and code host again whenever the issue moves. */
function useIssueLiveStatus(issue: AgentTeamIssue): AgentTeamIssueLiveStatus | null {
  const [status, setStatus] = useState<AgentTeamIssueLiveStatus | null>(null)
  const { id, updatedAt } = issue
  useEffect(() => {
    let cancelled = false
    void window.api.agentTeam
      .issueLiveStatus(id)
      .then((next) => {
        if (!cancelled) {
          setStatus(next)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [id, updatedAt])
  return status
}

function reviewStateLabel(review: NonNullable<AgentTeamIssueLiveStatus['review']>): string {
  switch (review.state) {
    case 'open':
      return translate('auto.components.agentTeam.TeamIssueSheet.reviewOpen', 'Open')
    case 'draft':
      return translate('auto.components.agentTeam.TeamIssueSheet.reviewDraft', 'Draft')
    case 'merged':
      return translate('auto.components.agentTeam.TeamIssueSheet.reviewMerged', 'Merged')
    case 'closed':
      return translate('auto.components.agentTeam.TeamIssueSheet.reviewClosed', 'Closed')
  }
}

function checksLabel(checks: NonNullable<AgentTeamIssueLiveStatus['review']>['checks']): string {
  switch (checks) {
    case 'success':
      return translate('auto.components.agentTeam.TeamIssueSheet.checksPassed', 'checks passed')
    case 'failure':
      return translate('auto.components.agentTeam.TeamIssueSheet.checksFailed', 'checks failed')
    case 'pending':
      return translate('auto.components.agentTeam.TeamIssueSheet.checksRunning', 'checks running')
    default:
      return ''
  }
}

/** Tracker state and labels, and the branch's pull request state, as their services report them. */
export function TeamIssueLiveStatus({
  issue
}: {
  issue: AgentTeamIssue
}): React.JSX.Element | null {
  const status = useIssueLiveStatus(issue)
  if (!status || (!status.tracker && !status.review)) {
    return null
  }
  const { tracker, review } = status
  const checks = review ? checksLabel(review.checks) : ''
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {tracker ? (
        <Badge variant={tracker.open ? 'outline' : 'secondary'}>
          {tracker.open
            ? translate(
                'auto.components.agentTeam.TeamIssueSheet.trackerOpen',
                'Open · {{state}}',
                {
                  state: tracker.state
                }
              )
            : translate(
                'auto.components.agentTeam.TeamIssueSheet.trackerClosed',
                'Closed · {{state}}',
                { state: tracker.state }
              )}
        </Badge>
      ) : null}
      {tracker?.labels.map((label) => (
        <Badge key={label} variant="secondary" className="font-normal">
          {label}
        </Badge>
      ))}
      {review ? (
        <a
          href={review.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <GitBranch className="size-3" />
          {isMergeRequestUrl(review.url)
            ? translate(
                'auto.components.agentTeam.TeamIssueSheet.mergeRequestState',
                'MR !{{number}}',
                {
                  number: review.number
                }
              )
            : translate(
                'auto.components.agentTeam.TeamIssueSheet.pullRequestState',
                'PR #{{number}}',
                {
                  number: review.number
                }
              )}
          <span className="text-foreground">{reviewStateLabel(review)}</span>
          {checks ? <span>· {checks}</span> : null}
        </a>
      ) : null}
    </div>
  )
}

/** Approve, hold, re-wire or discard an issue: the same moves the Manager has in the CLI. */
export function TeamIssueActions({
  issue,
  state,
  onDiscarded
}: {
  issue: AgentTeamIssue
  state: AgentTeamState
  onDiscarded: () => void
}): React.JSX.Element | null {
  const run = useAgentTeamCommand()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  if (issue.status === 'done' || issue.status === 'discarded') {
    return null
  }
  const running = openAssignment(issue) !== undefined
  const candidates = state.issues.filter(
    (other) => other.id !== issue.id && other.status !== 'discarded'
  )
  const setDependencies = (dependsOn: string[]): void => {
    void run({ kind: 'issue.update', issueId: issue.id, dependsOn })
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {issue.status === 'registered' ? (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => void run({ kind: 'issue.approve', issueIds: [issue.id] })}
        >
          <Check />
          {translate('auto.components.agentTeam.TeamIssueCard.approve', 'Approve')}
        </Button>
      ) : null}
      {issue.status === 'queued' ? (
        <Button
          size="xs"
          variant="outline"
          onClick={() => void run({ kind: 'issue.hold', issueIds: [issue.id] })}
        >
          <Pause />
          {translate('auto.components.agentTeam.TeamIssueSheet.hold', 'Hold')}
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="xs" variant="outline" disabled={candidates.length === 0}>
            <Link2 />
            {translate('auto.components.agentTeam.TeamIssueSheet.editDependencies', 'Dependencies')}
            {issue.dependsOn.length > 0 ? (
              <span className="text-muted-foreground">{issue.dependsOn.length}</span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-auto">
          <DropdownMenuLabel>
            {translate(
              'auto.components.agentTeam.TeamIssueSheet.dependsOnPicker',
              'Starts after these issues are done'
            )}
          </DropdownMenuLabel>
          {candidates.map((other) => {
            const checked = issue.dependsOn.includes(other.id)
            return (
              <DropdownMenuCheckboxItem
                key={other.id}
                checked={checked}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(next) =>
                  setDependencies(
                    next
                      ? [...issue.dependsOn, other.id]
                      : issue.dependsOn.filter((id) => id !== other.id)
                  )
                }
              >
                <span className="shrink-0 font-mono text-muted-foreground">{issueKey(other)}</span>
                <span className="truncate">{other.title}</span>
              </DropdownMenuCheckboxItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="xs" variant="ghost" onClick={() => setConfirmDiscard(true)}>
        <Trash2 />
        {translate('auto.components.agentTeam.TeamIssueSheet.discard', 'Discard')}
      </Button>
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {translate(
                'auto.components.agentTeam.TeamIssueSheet.discardTitle',
                'Discard {{key}}?',
                { key: issueKey(issue) }
              )}
            </DialogTitle>
            <DialogDescription>
              {running
                ? translate(
                    'auto.components.agentTeam.TeamIssueSheet.discardRunning',
                    'A seat is working on it: its session stops and the worktree is removed. The tracker issue stays as it is.'
                  )
                : translate(
                    'auto.components.agentTeam.TeamIssueSheet.discardIdle',
                    'It leaves the board and its worktree is removed. The tracker issue stays as it is.'
                  )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
              {translate('auto.components.agentTeam.TeamIssueSheet.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDiscard(false)
                void run({
                  kind: 'issue.decide',
                  issueId: issue.id,
                  decision: { kind: 'discard' }
                }).then((next) => {
                  if (next) {
                    onDiscarded()
                  }
                })
              }}
            >
              {translate('auto.components.agentTeam.TeamIssueSheet.discard', 'Discard')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
