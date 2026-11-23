import { CircleX } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { issueKey } from './team-labels'
import { useAgentTeamCommand } from './use-agent-team-state'

/** Seats whose session could not start: the issue waits until it is retried or the seat fixed. */
export function TeamLaunchFailures({
  state,
  onOpenSettings
}: {
  state: AgentTeamState
  onOpenSettings: () => void
}): React.JSX.Element | null {
  const run = useAgentTeamCommand()
  const failures = state.issues.flatMap((issue) => {
    const last = issue.assignments.at(-1)
    if (issue.status !== 'needs-you' || last?.stopReason !== 'launch-failed') {
      return []
    }
    const seat = state.seats.find((candidate) => candidate.id === last.seatId)
    return [{ issue, detail: last.stopDetail ?? '', seatName: seat?.name ?? '—' }]
  })
  if (failures.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-2">
      {failures.map(({ issue, detail, seatName }) => (
        <div
          key={issue.id}
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2"
        >
          <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium">
              {translate(
                'auto.components.agentTeam.TeamLaunchFailures.title',
                "{{seat}} couldn't start {{key}}",
                { seat: seatName, key: issueKey(issue) }
              )}
            </span>
            {detail ? (
              <code className="truncate font-mono text-xs text-muted-foreground" title={detail}>
                {detail}
              </code>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {translate(
                'auto.components.agentTeam.TeamLaunchFailures.hint',
                'Install or sign in to that agent CLI, or move the seat to another agent. The rest of the team keeps working.'
              )}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="xs"
              variant="secondary"
              onClick={() =>
                void run({ kind: 'issue.decide', issueId: issue.id, decision: { kind: 'resume' } })
              }
            >
              {translate('auto.components.agentTeam.TeamLaunchFailures.retry', 'Retry')}
            </Button>
            <Button size="xs" variant="ghost" onClick={onOpenSettings}>
              {translate('auto.components.agentTeam.TeamLaunchFailures.editSeat', 'Edit seat')}
            </Button>
            {detail ? (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => void window.api.ui.writeClipboardText(detail)}
              >
                {translate('auto.components.agentTeam.TeamLaunchFailures.copy', 'Copy error')}
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
