import { openAssignment } from './agent-team-pipeline'
import type { AgentTeam, AgentTeamState } from './agent-team-types'

function seatsWithOpenWork(state: AgentTeamState): Set<string> {
  return new Set(
    state.issues.flatMap((issue) => {
      const assignment = openAssignment(issue)
      return assignment ? [assignment.seatId] : []
    })
  )
}

/** Seats live in one step: those listed nowhere in `teams` are retired, unless a step is still running on them. */
export function retireSeatsOutsideSteps(
  state: AgentTeamState,
  teams: readonly AgentTeam[],
  now: number
): AgentTeamState['seats'] {
  const listed = new Set(teams.flatMap((team) => team.steps.flatMap((step) => step.seatIds)))
  const busy = seatsWithOpenWork(state)
  return state.seats.map((seat) =>
    seat.retiredAt === undefined && !listed.has(seat.id) && !busy.has(seat.id)
      ? { ...seat, retiredAt: now }
      : seat
  )
}

/** Retired seats leave their steps, and seats in no step are retired; older files kept both. */
export function withConsistentSeats(state: AgentTeamState, now: number): AgentTeamState {
  const retired = new Set(
    state.seats.filter((seat) => seat.retiredAt !== undefined).map((seat) => seat.id)
  )
  let changed = false
  const teams = state.teams.map((team) => {
    if (!team.steps.some((step) => step.seatIds.some((id) => retired.has(id)))) {
      return team
    }
    changed = true
    return {
      ...team,
      steps: team.steps.map((step) => ({
        ...step,
        seatIds: step.seatIds.filter((id) => !retired.has(id))
      }))
    }
  })
  const seats = retireSeatsOutsideSteps(state, teams, now)
  if (seats.some((seat, index) => seat !== state.seats[index])) {
    changed = true
  }
  return changed ? { ...state, teams, seats } : state
}
