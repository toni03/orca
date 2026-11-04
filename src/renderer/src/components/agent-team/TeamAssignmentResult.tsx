import { translate } from '@/i18n/i18n'
import { formatTokens } from '@/components/stats/usage-formatters'
import type { AgentTeamAssignment } from '../../../../shared/agent-team/agent-team-types'

export function assignmentResultLabel(assignment: AgentTeamAssignment): string {
  if (assignment.result) {
    switch (assignment.result.kind) {
      case 'done':
        return translate('auto.components.agentTeam.TeamActivity.done', 'Done')
      case 'blocked':
        return translate('auto.components.agentTeam.TeamActivity.blocked', 'Blocked')
      case 'pass':
        return translate('auto.components.agentTeam.TeamActivity.pass', 'Passed')
      case 'changes':
        return translate('auto.components.agentTeam.TeamActivity.changes', 'Changes requested')
    }
  }
  if (assignment.stopReason) {
    return assignment.stopReason === 'cancelled'
      ? translate('auto.components.agentTeam.TeamActivity.cancelled', 'Cancelled')
      : translate('auto.components.agentTeam.TeamActivity.stopped', 'Stopped without a result')
  }
  return assignment.endedAt === undefined
    ? translate('auto.components.agentTeam.TeamActivity.running', 'Running')
    : '—'
}

export function AssignmentTokens({
  assignment
}: {
  assignment: AgentTeamAssignment
}): React.JSX.Element {
  const usage = assignment.usage
  if (!usage) {
    return (
      <span className="text-muted-foreground">{assignment.endedAt === undefined ? '' : '…'}</span>
    )
  }
  if (usage.status === 'unavailable') {
    return (
      <span className="text-muted-foreground" title={usage.reason}>
        —
      </span>
    )
  }
  return (
    <span
      title={translate(
        'auto.components.agentTeam.TeamActivity.tokensDetail',
        'Input {{input}} · output {{output}} · cache read {{cache}}',
        {
          input: formatTokens(usage.inputTokens),
          output: formatTokens(usage.outputTokens),
          cache: formatTokens(usage.cacheReadTokens)
        }
      )}
    >
      {formatTokens(usage.totalTokens)}
    </span>
  )
}
