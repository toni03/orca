import { BUILTIN_TEAM_TEMPLATES } from '../../shared/agent-team/agent-team-builtin-templates'
import type {
  AgentTeam,
  AgentTeamSeat,
  AgentTeamState,
  AgentTeamStep
} from '../../shared/agent-team/agent-team-types'
import { resolveByIdOrName } from './agent-team-config-views'

export type AgentTeamSeatView = Pick<AgentTeamSeat, 'id' | 'name' | 'agent' | 'model' | 'effort'>

export type AgentTeamView = {
  id: string
  name: string
  paused: boolean
  steps: {
    id: string
    name: string
    roleId: string
    role: string
    stepType: string
    seats: AgentTeamSeatView[]
  }[]
}

export function resolveTeam(state: AgentTeamState, ref: string): AgentTeam {
  return resolveByIdOrName(
    state.teams,
    ref,
    (team) => team.id,
    (team) => team.name,
    'team',
    'orca team context'
  )
}

export function resolveStep(team: AgentTeam, ref: string): AgentTeamStep {
  return resolveByIdOrName(
    team.steps,
    ref,
    (step) => step.id,
    (step) => step.name,
    `step of ${team.name}`,
    `orca team show --team "${team.name}"`
  )
}

/** `development`, `security` or `design`, or the full template id. */
export function resolveTeamTemplate(ref: string): string {
  const wanted = ref.trim().toLowerCase()
  const template = BUILTIN_TEAM_TEMPLATES.find(
    (candidate) => candidate.id === wanted || candidate.id === `builtin:${wanted}`
  )
  if (!template) {
    const names = BUILTIN_TEAM_TEMPLATES.map((candidate) => candidate.id.replace('builtin:', ''))
    throw new Error(`No team template ${ref}. Use ${names.join(', ')} or leave --template out.`)
  }
  return template.id
}

export function seatView(seat: AgentTeamSeat): AgentTeamSeatView {
  return {
    id: seat.id,
    name: seat.name,
    agent: seat.agent,
    ...(seat.model ? { model: seat.model } : {}),
    ...(seat.effort ? { effort: seat.effort } : {})
  }
}

export function teamView(state: AgentTeamState, team: AgentTeam): AgentTeamView {
  const seats = new Map(
    state.seats.filter((seat) => seat.retiredAt === undefined).map((seat) => [seat.id, seat])
  )
  return {
    id: team.id,
    name: team.name,
    paused: team.paused === true,
    steps: team.steps.map((step) => {
      const role = state.roles.find((candidate) => candidate.id === step.roleId)
      return {
        id: step.id,
        name: step.name,
        roleId: step.roleId,
        role: role?.name ?? step.roleId,
        stepType: role?.stepType ?? 'build',
        seats: step.seatIds.flatMap((id) => {
          const seat = seats.get(id)
          return seat ? [seatView(seat)] : []
        })
      }
    })
  }
}

/** The team as it is after a command, or null when the command removed it. */
export function teamViewById(state: AgentTeamState, teamId: string): AgentTeamView | null {
  const team = state.teams.find((candidate) => candidate.id === teamId)
  return team ? teamView(state, team) : null
}
