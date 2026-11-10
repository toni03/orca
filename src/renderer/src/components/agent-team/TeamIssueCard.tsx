import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  GitPullRequest,
  LoaderCircle,
  X
} from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { openAssignment, stepRole } from '../../../../shared/agent-team/agent-team-pipeline'
import type { AgentTeamWaitReason } from '../../../../shared/agent-team/agent-team-scheduler'
import type { Repo } from '../../../../shared/repo-types'
import type { AgentTeamIssue, AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import {
  formatDuration,
  issueKey,
  needsYouLabel,
  openReviewLabel,
  trackerLabel,
  waitReasonLabel
} from './team-labels'
import { TeamIconButton, TeamIconLink } from './TeamIconButton'
import { TeamProjectAvatar } from './TeamProjectAvatar'

type Props = {
  issue: AgentTeamIssue
  state: AgentTeamState
  repo: Repo | undefined
  projectName: string
  /** 1-based place in the priority queue. */
  position?: number
  /** Grouped lanes already name the project. */
  hideProject?: boolean
  waitReason?: AgentTeamWaitReason
  onApprove?: () => void
  onMove?: (direction: -1 | 1) => void
  onOpen: (issue: AgentTeamIssue) => void
  drag?: {
    onDragStart: (event: React.DragEvent) => void
    onDragOver: (event: React.DragEvent) => void
    onDrop: (event: React.DragEvent) => void
    dropTarget: boolean
  }
  now: number
}

type CheckIndicator = { stepId: string; name: string; result: 'pass' | 'changes' | 'running' }

/** Result of each Check step in the current round: passed, sent back, or running now. */
function checkIndicators(issue: AgentTeamIssue, state: AgentTeamState): CheckIndicator[] {
  const team = state.teams.find((candidate) => candidate.id === issue.teamId)
  if (!team) {
    return []
  }
  return team.steps.flatMap((step, index): CheckIndicator[] => {
    if (stepRole(team, index, state.roles)?.stepType !== 'check') {
      return []
    }
    const inRound = issue.assignments.filter(
      (assignment) => assignment.stepId === step.id && assignment.round === issue.round
    )
    const last = inRound.at(-1)
    if (!last) {
      return []
    }
    if (last.endedAt === undefined) {
      return [{ stepId: step.id, name: step.name, result: 'running' }]
    }
    const kind = last.result?.kind
    return kind === 'pass' || kind === 'changes'
      ? [{ stepId: step.id, name: step.name, result: kind }]
      : []
  })
}

function needsYouBadge(issue: AgentTeamIssue, state: AgentTeamState): string | null {
  const reason = issue.needsYou?.reason
  if (!reason) {
    return null
  }
  if (reason === 'escalated') {
    return translate(
      'auto.components.agentTeam.TeamIssueCard.escalated',
      'Escalated · {{round}}/{{rounds}}',
      {
        round: issue.round,
        rounds: state.workflow.roundsPerIssue
      }
    )
  }
  if (reason === 'ready') {
    return issue.mergeRequest
      ? translate('auto.components.agentTeam.TeamIssueCard.readyToMerge', 'Ready to merge')
      : needsYouLabel(reason)
  }
  return needsYouLabel(reason)
}

export function TeamIssueCard({
  issue,
  state,
  repo,
  projectName,
  position,
  hideProject,
  waitReason,
  onApprove,
  onMove,
  onOpen,
  drag,
  now
}: Props): React.JSX.Element {
  const open = openAssignment(issue)
  const seat = open ? state.seats.find((candidate) => candidate.id === open.seatId) : undefined
  const needsYou = issue.status === 'needs-you' && issue.needsYou
  const indicators = checkIndicators(issue, state)
  const badge = needsYou ? needsYouBadge(issue, state) : null
  const key = position !== undefined ? `${position} · ${issueKey(issue)}` : issueKey(issue)

  return (
    <article
      draggable={drag !== undefined}
      onDragStart={drag?.onDragStart}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
      className={cn(
        'group flex flex-col gap-1 rounded-lg border border-border/60 bg-card px-2.5 py-2 shadow-xs',
        needsYou && 'border-agent-question bg-agent-question/10',
        drag && 'cursor-grab active:cursor-grabbing',
        drag?.dropTarget && 'ring-2 ring-ring'
      )}
    >
      <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
        {hideProject ? null : (
          <>
            <TeamProjectAvatar repo={repo} name={projectName} />
            <span className="truncate font-medium text-foreground">{projectName}</span>
          </>
        )}
        <span className="shrink-0 font-mono">{key}</span>
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          {issue.mergeRequest ? (
            <TeamIconLink
              href={issue.mergeRequest.url}
              className="inline-flex size-5 items-center justify-center rounded hover:bg-accent hover:text-foreground"
              label={openReviewLabel(issue.mergeRequest.url)}
            >
              <GitPullRequest className="size-3" />
            </TeamIconLink>
          ) : null}
          {issue.tracker?.url ? (
            <a
              href={issue.tracker.url}
              target="_blank"
              rel="noreferrer"
              aria-label={translate(
                'auto.components.agentTeam.TeamIssueCard.openTracker',
                'Open {{key}} in the tracker',
                { key: issueKey(issue) }
              )}
              className="inline-flex h-5 items-center gap-0.5 rounded px-1 text-[10px] hover:bg-accent hover:text-foreground"
            >
              {trackerLabel(issue.tracker.provider)}
              <ExternalLink className="size-2.5" />
            </a>
          ) : null}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onOpen(issue)}
        className="text-left text-[13px] font-medium leading-snug hover:underline"
      >
        {issue.title}
      </button>
      <div className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
        {badge ? (
          <span className="inline-flex h-5 items-center rounded-full border border-agent-question/45 bg-agent-question/10 px-2 font-medium text-agent-question-text">
            {badge}
          </span>
        ) : null}
        {seat ? <Badge variant="secondary">{seat.name}</Badge> : null}
        {issue.assignments.length > 0 && !needsYou ? (
          <Badge variant="outline">
            {issue.round}/{state.workflow.roundsPerIssue}
          </Badge>
        ) : null}
        {issue.scope === 'exclusive' ? (
          <Badge variant="outline">
            {translate('auto.components.agentTeam.TeamIssueCard.exclusive', 'Locks project')}
          </Badge>
        ) : null}
        {indicators.map((indicator) => (
          <span key={indicator.stepId} className="inline-flex items-center gap-0.5">
            {indicator.result === 'running' ? (
              <LoaderCircle className="size-3 animate-spin text-agent-working" />
            ) : indicator.result === 'pass' ? (
              <Check className="size-3 text-status-success" />
            ) : (
              <X className="size-3 text-destructive" />
            )}
            {indicator.name}
          </span>
        ))}
        {open ? <span className="ml-auto">{formatDuration(now - open.startedAt)}</span> : null}
      </div>
      {waitReason ? (
        <div className="text-2xs text-muted-foreground">{waitReasonLabel(waitReason, state)}</div>
      ) : null}
      {needsYou ? (
        <p className="line-clamp-2 whitespace-pre-wrap text-2xs text-muted-foreground">
          {needsYou.detail}
        </p>
      ) : null}
      {onApprove || onMove || needsYou ? (
        <div className="flex items-center gap-1">
          {needsYou ? (
            <Button size="xs" variant="secondary" onClick={() => onOpen(issue)}>
              {translate('auto.components.agentTeam.TeamIssueCard.review', 'Review')}
            </Button>
          ) : null}
          {onApprove ? (
            <Button size="xs" variant="secondary" onClick={onApprove}>
              {translate('auto.components.agentTeam.TeamIssueCard.approve', 'Approve')}
            </Button>
          ) : null}
          {onMove ? (
            <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <TeamIconButton
                label={translate(
                  'auto.components.agentTeam.TeamIssueCard.moveUp',
                  'Move up in the queue'
                )}
                onClick={() => onMove(-1)}
              >
                <ArrowUp />
              </TeamIconButton>
              <TeamIconButton
                label={translate(
                  'auto.components.agentTeam.TeamIssueCard.moveDown',
                  'Move down in the queue'
                )}
                onClick={() => onMove(1)}
              >
                <ArrowDown />
              </TeamIconButton>
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
