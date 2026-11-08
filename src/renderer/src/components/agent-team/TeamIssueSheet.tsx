import { useState } from 'react'
import { ExternalLink, FolderGit2, GitPullRequest } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTokens } from '@/components/stats/usage-formatters'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import type { AgentTeamIssue, AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { formatDuration, issueKey, issueStatusLabel, trackerLabel } from './team-labels'
import { TeamDecisionForm } from './TeamDecisionForm'
import { TeamIconButton, TeamIconLink } from './TeamIconButton'
import { changeTotals, TeamIssueChanges, useIssueBranchChanges } from './TeamIssueChanges'
import { TeamProjectAvatar } from './TeamProjectAvatar'
import { IssueDetails, RoundReports, SessionsByRound } from './TeamIssueSheetSections'
import { useAgentTeamCommand } from './use-agent-team-state'
import { useNow } from './use-now'

type Props = {
  issueId: string | null
  state: AgentTeamState
  onClose: () => void
}

const linkClass =
  'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground'

/** Opens the worktree with Orca's review panel, where its merge and checks live. */
function useRevealReviewPanel(): (worktreeId: string) => void {
  const setRightSidebarOpen = useAppStore((s) => s.setRightSidebarOpen)
  const setRightSidebarTab = useAppStore((s) => s.setRightSidebarTab)
  return (worktreeId) => {
    activateAndRevealWorktree(worktreeId)
    setRightSidebarTab('checks')
    setRightSidebarOpen(true)
  }
}

function SheetBody({
  issue,
  state,
  onClose
}: {
  issue: AgentTeamIssue
  state: AgentTeamState
  onClose: () => void
}): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const run = useAgentTeamCommand()
  const now = useNow(30_000)
  const revealReview = useRevealReviewPanel()
  const [tab, setTab] = useState('overview')
  const changes = useIssueBranchChanges(issue, state)
  const repo = repos.find((candidate) => candidate.id === issue.repoId)
  const projectName = repo?.displayName ?? issue.repoId
  const team = state.teams.find((candidate) => candidate.id === issue.teamId)
  const worktreeOpen =
    issue.worktreeId !== undefined && issue.status !== 'done' && issue.status !== 'discarded'
  const activeMs = issue.assignments.reduce(
    (total, assignment) => total + (assignment.endedAt ?? now) - assignment.startedAt,
    0
  )
  const tokens = issue.assignments.reduce(
    (total, assignment) =>
      total + (assignment.usage?.status === 'known' ? assignment.usage.totalTokens : 0),
    0
  )
  const totals = changes.kind === 'ready' ? changeTotals(changes.result) : null
  const worktreeId = worktreeOpen ? issue.worktreeId : undefined

  return (
    <>
      <div className="border-b border-border pr-8">
        <SheetHeader>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TeamProjectAvatar repo={repo} name={projectName} />
            <span className="font-medium text-foreground">{projectName}</span>
            <span className="font-mono">{issueKey(issue)}</span>
            {issue.tracker ? (
              <Badge variant="outline">{trackerLabel(issue.tracker.provider)}</Badge>
            ) : null}
            <span className="ml-auto flex items-center gap-0.5">
              {issue.tracker?.url ? (
                <TeamIconLink
                  href={issue.tracker.url}
                  className={linkClass}
                  label={translate(
                    'auto.components.agentTeam.TeamIssueCard.openTracker',
                    'Open {{key}} in the tracker',
                    { key: issueKey(issue) }
                  )}
                >
                  <ExternalLink className="size-3.5" />
                </TeamIconLink>
              ) : null}
              {issue.mergeRequest ? (
                <TeamIconLink
                  href={issue.mergeRequest.url}
                  className={linkClass}
                  label={translate(
                    'auto.components.agentTeam.TeamIssueCard.openMergeRequest',
                    'Open the merge request'
                  )}
                >
                  <GitPullRequest className="size-3.5" />
                </TeamIconLink>
              ) : null}
              {worktreeId ? (
                <TeamIconButton
                  size="icon-sm"
                  label={translate(
                    'auto.components.agentTeam.TeamIssueHistoryDialog.openWorktree',
                    'Open the worktree'
                  )}
                  onClick={() => {
                    activateAndRevealWorktree(worktreeId)
                    onClose()
                  }}
                >
                  <FolderGit2 />
                </TeamIconButton>
              ) : null}
            </span>
          </div>
          <SheetTitle>{issue.title}</SheetTitle>
          <SheetDescription>
            <span className="block">{issueStatusLabel(issue, state)}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {team ? <span>{team.name}</span> : null}
              {issue.branch ? <span className="font-mono">{issue.branch}</span> : null}
              {totals && changes.kind === 'ready' ? (
                <span className="font-mono">
                  +{totals.added} −{totals.removed} ·{' '}
                  {translate('auto.components.agentTeam.TeamIssueSheet.files', '{{count}} files', {
                    count: changes.result.summary.changedFiles
                  })}
                </span>
              ) : null}
              {activeMs > 0 ? (
                <span>
                  {translate('auto.components.agentTeam.TeamIssueSheet.active', '{{time}} active', {
                    time: formatDuration(activeMs)
                  })}
                </span>
              ) : null}
              {tokens > 0 ? (
                <span>
                  {translate('auto.components.agentTeam.TeamActivity.tokens', '{{value}} tokens', {
                    value: formatTokens(tokens)
                  })}
                </span>
              ) : null}
            </span>
          </SheetDescription>
        </SheetHeader>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 scrollbar-sleek">
        {issue.status === 'needs-you' && issue.needsYou ? (
          <section className="flex flex-col gap-2 rounded-lg border border-agent-question/45 bg-agent-question/5 p-3">
            <h3 className="text-sm font-semibold">
              {translate(
                'auto.components.agentTeam.TeamIssueSheet.decide',
                'Decide what happens to {{target}}',
                { target: issue.branch ?? issueKey(issue) }
              )}
            </h3>
            <p className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground scrollbar-sleek">
              {issue.needsYou.detail}
            </p>
            <TeamDecisionForm
              issue={issue}
              run={async (decision) =>
                (await run({ kind: 'issue.decide', issueId: issue.id, decision })) !== null
              }
              onMerge={
                worktreeId && issue.mergeRequest
                  ? () => {
                      revealReview(worktreeId)
                      onClose()
                    }
                  : undefined
              }
            />
          </section>
        ) : null}
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col">
          <TabsList size="sm" className="mb-3">
            <TabsTrigger value="overview">
              {translate('auto.components.agentTeam.TeamIssueSheet.overview', 'Overview')}
            </TabsTrigger>
            <TabsTrigger value="changes">
              {translate('auto.components.agentTeam.TeamIssueSheet.changes', 'Changes')}
              {changes.kind === 'ready' ? (
                <span className="text-muted-foreground">{changes.result.summary.changedFiles}</span>
              ) : null}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <div className="flex flex-col gap-5">
              <SessionsByRound issue={issue} state={state} now={now} />
              <IssueDetails issue={issue} state={state} />
              <RoundReports issue={issue} state={state} />
              {issue.assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {translate(
                    'auto.components.agentTeam.TeamIssueHistoryDialog.empty',
                    'No session has worked on this issue yet.'
                  )}
                </p>
              ) : null}
            </div>
          </TabsContent>
          <TabsContent value="changes">
            <TeamIssueChanges issue={issue} load={changes} onOpened={onClose} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

/** Everything about one issue: where it stands, what to decide, every session, report and change. */
export function TeamIssueSheet({ issueId, state, onClose }: Props): React.JSX.Element {
  const issue = issueId ? state.issues.find((candidate) => candidate.id === issueId) : undefined
  return (
    <Sheet open={issue !== undefined} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent className="w-full sm:max-w-[720px]">
        {issue ? <SheetBody key={issue.id} issue={issue} state={state} onClose={onClose} /> : null}
      </SheetContent>
    </Sheet>
  )
}
