import { ExternalLink, FolderGit2, GitPullRequest } from 'lucide-react'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import type {
  AgentTeamAssignment,
  AgentTeamIssue,
  AgentTeamState
} from '../../../../shared/agent-team/agent-team-types'
import { formatDuration, issueKey } from './team-labels'
import { AssignmentTokens, assignmentResultLabel } from './TeamAssignmentResult'
import { TeamIconButton, TeamIconLink } from './TeamIconButton'
import { useNow } from './use-now'

type Props = {
  issueId: string | null
  state: AgentTeamState
  onClose: () => void
}

function AssignmentEntry({
  issue,
  assignment,
  state,
  now
}: {
  issue: AgentTeamIssue
  assignment: AgentTeamAssignment
  state: AgentTeamState
  now: number
}): React.JSX.Element {
  const step = state.teams
    .find((team) => team.id === issue.teamId)
    ?.steps.find((candidate) => candidate.id === assignment.stepId)
  const seat = state.seats.find((candidate) => candidate.id === assignment.seatId)
  const result = assignment.result
  const questions = result?.kind === 'blocked' ? (result.questions ?? []) : []
  const findings = result && 'findings' in result ? (result.findings ?? []) : []

  return (
    <li className="flex flex-col gap-1.5 border-l-2 border-border pb-4 pl-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">{step?.name ?? '—'}</span>
        <span className="text-muted-foreground">{seat?.name ?? '—'}</span>
        <Badge variant="outline">
          {translate('auto.components.agentTeam.TeamIssueHistoryDialog.round', 'Round {{round}}', {
            round: assignment.round
          })}
        </Badge>
        <span className="ml-auto font-mono text-2xs text-muted-foreground">
          {new Date(assignment.startedAt).toLocaleString(getIntlLocale())} ·{' '}
          {formatDuration((assignment.endedAt ?? now) - assignment.startedAt)} ·{' '}
          <AssignmentTokens assignment={assignment} />
        </span>
      </div>
      <div className="text-xs font-medium">{assignmentResultLabel(assignment)}</div>
      {result?.summary ? (
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{result.summary}</p>
      ) : null}
      {questions.length > 0 ? (
        <ul className="list-disc pl-4 text-xs text-muted-foreground">
          {questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      ) : null}
      {findings.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs">
          {findings.map((finding) => (
            <li
              key={`${finding.severity}:${finding.file ?? ''}:${finding.line ?? ''}:${finding.message}`}
              className="text-muted-foreground"
            >
              <span className="font-medium text-foreground">[{finding.severity}]</span>{' '}
              {finding.message}
              {finding.file ? (
                <span className="font-mono">
                  {' '}
                  {finding.file}
                  {finding.line ? `:${finding.line}` : ''}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {assignment.stopDetail ? (
        <p className="text-xs text-muted-foreground">{assignment.stopDetail}</p>
      ) : null}
    </li>
  )
}

/** Everything the team did on one issue: each session, its result and what it reported. */
export function TeamIssueHistoryDialog({ issueId, state, onClose }: Props): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const now = useNow(60_000)
  const issue = issueId ? state.issues.find((candidate) => candidate.id === issueId) : undefined
  const project = issue ? repos.find((repo) => repo.id === issue.repoId)?.displayName : undefined
  const worktreeOpen =
    issue?.worktreeId !== undefined && issue.status !== 'done' && issue.status !== 'discarded'

  return (
    <Dialog open={issue !== undefined} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-2xl">
        {issue ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 pr-6">
                <DialogTitle>
                  {issueKey(issue)} · {issue.title}
                </DialogTitle>
                <span className="ml-auto flex shrink-0 items-center gap-1 text-muted-foreground">
                  {issue.mergeRequest ? (
                    <TeamIconLink
                      href={issue.mergeRequest.url}
                      className="inline-flex size-6 items-center justify-center rounded-md hover:bg-accent hover:text-foreground"
                      label={translate(
                        'auto.components.agentTeam.TeamIssueCard.openMergeRequest',
                        'Open the merge request'
                      )}
                    >
                      <GitPullRequest className="size-3.5" />
                    </TeamIconLink>
                  ) : null}
                  {issue.tracker?.url ? (
                    <TeamIconLink
                      href={issue.tracker.url}
                      className="inline-flex size-6 items-center justify-center rounded-md hover:bg-accent hover:text-foreground"
                      label={translate(
                        'auto.components.agentTeam.TeamIssueCard.openTracker',
                        'Open {{key}} in the tracker',
                        { key: issueKey(issue) }
                      )}
                    >
                      <ExternalLink className="size-3.5" />
                    </TeamIconLink>
                  ) : null}
                  {worktreeOpen && issue.worktreeId ? (
                    <TeamIconButton
                      size="icon-sm"
                      label={translate(
                        'auto.components.agentTeam.TeamIssueHistoryDialog.openWorktree',
                        'Open the worktree'
                      )}
                      onClick={() => {
                        if (issue.worktreeId) {
                          activateAndRevealWorktree(issue.worktreeId)
                          onClose()
                        }
                      }}
                    >
                      <FolderGit2 />
                    </TeamIconButton>
                  ) : null}
                </span>
              </div>
              <DialogDescription>
                {[project, issue.branch].filter(Boolean).join(' · ')}
              </DialogDescription>
            </DialogHeader>
            {issue.body.trim() ? (
              <p className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs scrollbar-sleek">
                {issue.body}
              </p>
            ) : null}
            {issue.assignments.length > 0 ? (
              <ol className="flex max-h-[50vh] flex-col overflow-auto pr-1 scrollbar-sleek">
                {issue.assignments.map((assignment) => (
                  <AssignmentEntry
                    key={assignment.id}
                    issue={issue}
                    assignment={assignment}
                    state={state}
                    now={now}
                  />
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                {translate(
                  'auto.components.agentTeam.TeamIssueHistoryDialog.empty',
                  'No session has worked on this issue yet.'
                )}
              </p>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
