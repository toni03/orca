import { translate } from '@/i18n/i18n'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { formatDuration, trackerLabel } from './team-labels'

/** Which trackers the team updates and how fresh they are: moves wait for an idle Manager. */
export function TeamTrackerSyncStatus({
  state,
  now
}: {
  state: AgentTeamState
  now: number
}): React.JSX.Element | null {
  const providers = [
    ...new Set(
      state.projects.flatMap((project) => (project.tracker ? [project.tracker.provider] : []))
    )
  ]
  if (providers.length === 0) {
    return null
  }
  const names = providers.map(trackerLabel).join(' · ')
  const pending = state.trackerEvents?.length ?? 0
  let detail: string
  if (state.workflow.syncTracker === false) {
    detail = translate('auto.components.agentTeam.TeamTrackerSyncStatus.off', 'sync off')
  } else if (pending > 0) {
    detail = translate(
      'auto.components.agentTeam.TeamTrackerSyncStatus.pending',
      '{{count}} updates wait for the Manager',
      { count: pending }
    )
  } else if (state.trackerSyncedAt) {
    detail = translate(
      'auto.components.agentTeam.TeamTrackerSyncStatus.synced',
      'synced {{ago}} ago',
      {
        ago: formatDuration(now - state.trackerSyncedAt)
      }
    )
  } else {
    detail = translate('auto.components.agentTeam.TeamTrackerSyncStatus.upToDate', 'up to date')
  }
  return (
    <span className="text-xs text-muted-foreground">
      {names} · {detail}
    </span>
  )
}
