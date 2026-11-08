import { translate } from '@/i18n/i18n'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'

type Props = { state: AgentTeamState; teamFilter: string }

/** Says which teams and seats take no new steps; pausing itself lives in Settings. */
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
  const pausedSeats = state.seats.filter(
    (seat) => seat.paused === true && seat.retiredAt === undefined
  )
  const parts = [
    paused.length > 0
      ? translate(
          'auto.components.agentTeam.TeamPausedNotice.teams',
          'Paused: {{teams}}. Running steps finish, nothing new starts. Resume in Settings › Teams.',
          { teams: paused.map((team) => team.name).join(', ') }
        )
      : null,
    pausedSeats.length > 0
      ? translate(
          'auto.components.agentTeam.TeamPausedNotice.seats',
          'Paused seats: {{seats}}. Their queued work goes to the other seats. Resume in Settings › Teams or Workflow.',
          { seats: pausedSeats.map((seat) => seat.name).join(', ') }
        )
      : null
  ].filter((part) => part !== null)
  return parts.length > 0 ? parts.join(' ') : null
}
