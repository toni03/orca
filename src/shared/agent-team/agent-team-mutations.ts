import { BUILTIN_TEAM_TEMPLATES } from './agent-team-builtin-templates'
import { openAssignment } from './agent-team-pipeline'
import type { AgentTeam, AgentTeamSeat, AgentTeamState } from './agent-team-types'
import type { TuiAgent } from '../agent-launch/catalog/tui-agent'

export class AgentTeamMutationError extends Error {}

export type AgentTeamMutationIds = { newId: () => string; now: number }

export function requireTeam(state: AgentTeamState, teamId: string): AgentTeam {
  const team = state.teams.find((candidate) => candidate.id === teamId)
  if (!team) {
    throw new AgentTeamMutationError(`No team ${teamId}.`)
  }
  return team
}

function replaceTeam(state: AgentTeamState, team: AgentTeam): AgentTeamState {
  return {
    ...state,
    teams: state.teams.map((candidate) => (candidate.id === team.id ? team : candidate))
  }
}

export function teamHasActiveIssues(state: AgentTeamState, teamId: string): boolean {
  return state.issues.some(
    (issue) =>
      issue.teamId === teamId && (issue.status === 'working' || openAssignment(issue) !== undefined)
  )
}

export function createTeam(
  state: AgentTeamState,
  input: { name: string; templateId?: string },
  ids: AgentTeamMutationIds
): AgentTeamState {
  const template = BUILTIN_TEAM_TEMPLATES.find((candidate) => candidate.id === input.templateId)
  const team: AgentTeam = {
    id: ids.newId(),
    name: input.name.trim() || template?.name || 'Team',
    createdAt: ids.now,
    ...(template ? { templateId: template.id } : {}),
    steps: (template?.steps ?? []).map((step) => ({
      id: ids.newId(),
      name: step.name,
      roleId: step.roleTemplateId,
      seatIds: []
    }))
  }
  return { ...state, teams: [...state.teams, team] }
}

export function renameTeam(state: AgentTeamState, teamId: string, name: string): AgentTeamState {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new AgentTeamMutationError('A team needs a name.')
  }
  return replaceTeam(state, { ...requireTeam(state, teamId), name: trimmed })
}

export function setTeamPaused(
  state: AgentTeamState,
  teamId: string,
  paused: boolean
): AgentTeamState {
  return replaceTeam(state, { ...requireTeam(state, teamId), paused })
}

export function deleteTeam(state: AgentTeamState, teamId: string, now: number): AgentTeamState {
  if (teamHasActiveIssues(state, teamId)) {
    throw new AgentTeamMutationError(
      'This team is working on issues; finish or discard them first.'
    )
  }
  const team = requireTeam(state, teamId)
  const seatIds = new Set(team.steps.flatMap((step) => step.seatIds))
  return {
    ...state,
    teams: state.teams.filter((candidate) => candidate.id !== teamId),
    seats: state.seats.map((seat) =>
      seatIds.has(seat.id) && seat.retiredAt === undefined ? { ...seat, retiredAt: now } : seat
    )
  }
}

export function addTeamStep(
  state: AgentTeamState,
  teamId: string,
  input: { name: string; roleId: string },
  ids: AgentTeamMutationIds
): AgentTeamState {
  if (!state.roles.some((role) => role.id === input.roleId)) {
    throw new AgentTeamMutationError(`No role ${input.roleId}.`)
  }
  const team = requireTeam(state, teamId)
  return replaceTeam(state, {
    ...team,
    steps: [
      ...team.steps,
      { id: ids.newId(), name: input.name.trim() || 'Step', roleId: input.roleId, seatIds: [] }
    ]
  })
}

export function updateTeamStep(
  state: AgentTeamState,
  teamId: string,
  stepId: string,
  patch: { name?: string; roleId?: string }
): AgentTeamState {
  const team = requireTeam(state, teamId)
  if (patch.roleId && !state.roles.some((role) => role.id === patch.roleId)) {
    throw new AgentTeamMutationError(`No role ${patch.roleId}.`)
  }
  return replaceTeam(state, {
    ...team,
    steps: team.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            ...(patch.name?.trim() ? { name: patch.name.trim() } : {}),
            ...(patch.roleId ? { roleId: patch.roleId } : {})
          }
        : step
    )
  })
}

export function removeTeamStep(
  state: AgentTeamState,
  teamId: string,
  stepId: string
): AgentTeamState {
  if (teamHasActiveIssues(state, teamId)) {
    throw new AgentTeamMutationError('Steps cannot be removed while the team is working on issues.')
  }
  const team = requireTeam(state, teamId)
  return replaceTeam(state, { ...team, steps: team.steps.filter((step) => step.id !== stepId) })
}

export function moveTeamStep(
  state: AgentTeamState,
  teamId: string,
  stepId: string,
  toIndex: number
): AgentTeamState {
  if (teamHasActiveIssues(state, teamId)) {
    throw new AgentTeamMutationError(
      'Steps cannot be reordered while the team is working on issues.'
    )
  }
  const team = requireTeam(state, teamId)
  const step = team.steps.find((candidate) => candidate.id === stepId)
  if (!step) {
    throw new AgentTeamMutationError(`No step ${stepId}.`)
  }
  const rest = team.steps.filter((candidate) => candidate.id !== stepId)
  const index = Math.max(0, Math.min(Math.trunc(toIndex), rest.length))
  return replaceTeam(state, {
    ...team,
    steps: [...rest.slice(0, index), step, ...rest.slice(index)]
  })
}

export function addSeat(
  state: AgentTeamState,
  input: { teamId: string; stepId: string; name: string; agent: TuiAgent; model?: string },
  ids: AgentTeamMutationIds
): AgentTeamState {
  const team = requireTeam(state, input.teamId)
  if (!team.steps.some((step) => step.id === input.stepId)) {
    throw new AgentTeamMutationError(`No step ${input.stepId}.`)
  }
  const seat: AgentTeamSeat = {
    id: ids.newId(),
    name: input.name.trim() || 'Seat',
    agent: input.agent,
    ...(input.model?.trim() ? { model: input.model.trim() } : {}),
    instructions: '',
    createdAt: ids.now
  }
  return {
    ...replaceTeam(state, {
      ...team,
      steps: team.steps.map((step) =>
        step.id === input.stepId ? { ...step, seatIds: [...step.seatIds, seat.id] } : step
      )
    }),
    seats: [...state.seats, seat]
  }
}

/** The CLI is not editable: rounds resume the same session kind. */
export function updateSeat(
  state: AgentTeamState,
  seatId: string,
  patch: { name?: string; model?: string | null; instructions?: string }
): AgentTeamState {
  return {
    ...state,
    seats: state.seats.map((seat) => {
      if (seat.id !== seatId) {
        return seat
      }
      const next: AgentTeamSeat = { ...seat }
      if (patch.name?.trim()) {
        next.name = patch.name.trim()
      }
      if (patch.model === null || patch.model?.trim() === '') {
        delete next.model
      } else if (patch.model) {
        next.model = patch.model.trim()
      }
      if (patch.instructions !== undefined) {
        next.instructions = patch.instructions
      }
      return next
    })
  }
}

export function setSeatsPaused(
  state: AgentTeamState,
  seatIds: readonly string[],
  paused: boolean
): AgentTeamState {
  const ids = new Set(seatIds)
  return {
    ...state,
    seats: state.seats.map((seat) => (ids.has(seat.id) ? { ...seat, paused } : seat))
  }
}

export function retireSeat(state: AgentTeamState, seatId: string, now: number): AgentTeamState {
  return {
    ...state,
    seats: state.seats.map((seat) => (seat.id === seatId ? { ...seat, retiredAt: now } : seat))
  }
}
