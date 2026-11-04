import { translate } from '@/i18n/i18n'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'

type Props = { state: AgentTeamState; teamFilter: string }

/** Says which teams take no new steps; pausing itself lives in Settings. */
export function TeamPausedNotice({ state, teamFilter }: Props): React.JSX.Element | null {
  const text = pausedText(state, teamFilter)
  return text ? <p className="text-xs text-muted-foreground">{text}</p> : null
}

function pausedText(state: AgentTeamState, teamFilter: string): string | null {
  if (state.workflow.paused) {
    return translate(
      'auto.components.agentTeam.TeamPausedNotice.all',
      'All teams are paused: running steps finish, nothing new starts. Resume in Settings › Workflow.'
    )
  }
  const paused = state.teams.filter(
    (team) => team.paused && (teamFilter === 'all' || team.id === teamFilter)
  )
  if (paused.length === 0) {
    return null
  }
  return translate(
    'auto.components.agentTeam.TeamPausedNotice.teams',
    'Paused: {{teams}}. Running steps finish, nothing new starts. Resume in Settings › Teams.',
    { teams: paused.map((team) => team.name).join(', ') }
  )
}
