import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { openAssignment } from '../../../../shared/agent-team/agent-team-pipeline'
import type { AgentTeamWaitReason } from '../../../../shared/agent-team/agent-team-scheduler'
import type { AgentTeamIssue, AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { formatDuration, issueKey, needsYouLabel, waitReasonLabel } from './team-labels'

type Props = {
  issue: AgentTeamIssue
  state: AgentTeamState
  projectName: string
  waitReason?: AgentTeamWaitReason
  onApprove?: () => void
  onMove?: (direction: -1 | 1) => void
  onDecide?: (issue: AgentTeamIssue) => void
  now: number
}

export function TeamIssueCard({
  issue,
  state,
  projectName,
  waitReason,
  onApprove,
  onMove,
  onDecide,
  now
}: Props): React.JSX.Element {
  const open = openAssignment(issue)
  const seat = open ? state.seats.find((candidate) => candidate.id === open.seatId) : undefined
  const team = state.teams.find((candidate) => candidate.id === issue.teamId)
  const needsYou = issue.status === 'needs-you' && issue.needsYou

  return (
    <article
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2 shadow-xs',
        needsYou && 'border-agent-question/60 bg-agent-question/5'
      )}
    >
      <div className="flex items-center gap-2 text-2xs text-muted-foreground">
        <span className="truncate font-medium text-foreground">{projectName}</span>
        <span className="font-mono">{issueKey(issue)}</span>
        {issue.tracker?.url ? (
          <a
            href={issue.tracker.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-0.5 hover:text-foreground"
            aria-label={translate(
              'auto.components.agentTeam.TeamIssueCard.openTracker',
              'Open {{key}} in the tracker',
              {
                key: issueKey(issue)
              }
            )}
          >
            <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>
      <div className="text-sm font-medium leading-snug">{issue.title}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
        {team ? <Badge variant="outline">{team.name}</Badge> : null}
        {issue.scope === 'exclusive' ? (
          <Badge variant="outline">
            {translate('auto.components.agentTeam.TeamIssueCard.exclusive', 'Locks project')}
          </Badge>
        ) : null}
        {issue.assignments.length > 0 ? (
          <span>
            {translate('auto.components.agentTeam.TeamIssueCard.round', 'Round {{round}}/{{max}}', {
              round: issue.round,
              max: state.workflow.roundsPerIssue
            })}
          </span>
        ) : null}
        {seat && open ? (
          <span className="ml-auto">
            {seat.name} · {formatDuration(now - open.startedAt)}
          </span>
        ) : null}
      </div>
      {waitReason ? (
        <div className="text-2xs text-muted-foreground">{waitReasonLabel(waitReason, state)}</div>
      ) : null}
      {needsYou ? (
        <div className="flex flex-col gap-1">
          <span className="text-2xs font-medium text-agent-question-text">
            {needsYouLabel(needsYou.reason)}
          </span>
          <p className="line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
            {needsYou.detail}
          </p>
          {onDecide ? (
            <Button
              size="xs"
              variant="secondary"
              className="self-start"
              onClick={() => onDecide(issue)}
            >
              {translate('auto.components.agentTeam.TeamIssueCard.review', 'Review')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {onApprove || onMove ? (
        <div className="flex items-center gap-1">
          {onApprove ? (
            <Button size="xs" variant="secondary" onClick={onApprove}>
              {translate('auto.components.agentTeam.TeamIssueCard.approve', 'Approve')}
            </Button>
          ) : null}
          {onMove ? (
            <>
              <Button
                size="icon-xs"
                variant="ghost"
                className="ml-auto"
                aria-label={translate(
                  'auto.components.agentTeam.TeamIssueCard.moveUp',
                  'Move up in the queue'
                )}
                onClick={() => onMove(-1)}
              >
                <ArrowUp />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={translate(
                  'auto.components.agentTeam.TeamIssueCard.moveDown',
                  'Move down in the queue'
                )}
                onClick={() => onMove(1)}
              >
                <ArrowDown />
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
