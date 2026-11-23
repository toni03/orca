import { defineMethod } from '../../core'
import {
  AgentTeamCreateParams,
  AgentTeamRefParams,
  AgentTeamSeatAddParams,
  AgentTeamSeatRefParams,
  AgentTeamStepAddParams,
  AgentTeamStepRefParams,
  AgentTeamStepUpdateParams,
  AgentTeamUpdateParams
} from '../../../../../shared/rpc-contract/agent-team-params'
import { isTuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent-config'
import { resolveRole, resolveSeat } from '../../../../agent-team/agent-team-config-views'
import {
  resolveStep,
  resolveTeam,
  resolveTeamTemplate,
  seatView,
  teamView,
  teamViewById
} from '../../../../agent-team/agent-team-structure-views'
import { requireAgentTeamService } from '../../../../agent-team/agent-team-service-registry'

function newIdAfter<T extends { id: string }>(before: readonly T[], after: readonly T[]): string {
  const known = new Set(before.map((item) => item.id))
  const created = after.find((item) => !known.has(item.id))
  if (!created) {
    throw new Error('Orca did not create it; try again.')
  }
  return created.id
}

/** Teams, their steps and seats from the CLI; the Settings › Team view does the same. */
export const AGENT_TEAM_STRUCTURE_METHODS = [
  defineMethod({
    name: 'team.show',
    permission: 'workspace',
    params: AgentTeamRefParams,
    handler: (params) => {
      const state = requireAgentTeamService().getState()
      return { team: teamView(state, resolveTeam(state, params.teamId)) }
    }
  }),
  defineMethod({
    name: 'team.create',
    permission: 'workspace',
    params: AgentTeamCreateParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const before = service.getState().teams
      const state = service.execute({
        kind: 'team.create',
        name: params.name,
        ...(params.templateId ? { templateId: resolveTeamTemplate(params.templateId) } : {})
      })
      return { team: teamViewById(state, newIdAfter(before, state.teams)) }
    }
  }),
  defineMethod({
    name: 'team.update',
    permission: 'workspace',
    params: AgentTeamUpdateParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const team = resolveTeam(service.getState(), params.teamId)
      const state = params.name
        ? service.execute({ kind: 'team.rename', teamId: team.id, name: params.name })
        : service.getState()
      return { team: teamViewById(state, team.id) }
    }
  }),
  defineMethod({
    name: 'team.delete',
    permission: 'workspace',
    params: AgentTeamRefParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const team = resolveTeam(service.getState(), params.teamId)
      service.execute({ kind: 'team.delete', teamId: team.id })
      return { deleted: team.name }
    }
  }),
  defineMethod({
    name: 'team.stepAdd',
    permission: 'workspace',
    params: AgentTeamStepAddParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const team = resolveTeam(service.getState(), params.teamId)
      const roleId = resolveRole(service.getState(), params.roleId).id
      let state = service.execute({ kind: 'step.add', teamId: team.id, name: params.name, roleId })
      if (params.position !== undefined) {
        const steps = state.teams.find((candidate) => candidate.id === team.id)?.steps ?? []
        state = service.execute({
          kind: 'step.move',
          teamId: team.id,
          stepId: newIdAfter(team.steps, steps),
          toIndex: params.position - 1
        })
      }
      return { team: teamViewById(state, team.id) }
    }
  }),
  defineMethod({
    name: 'team.stepUpdate',
    permission: 'workspace',
    params: AgentTeamStepUpdateParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const team = resolveTeam(service.getState(), params.teamId)
      const step = resolveStep(team, params.stepId)
      const roleId = params.roleId ? resolveRole(service.getState(), params.roleId).id : undefined
      let state = service.getState()
      if (params.name || roleId) {
        state = service.execute({
          kind: 'step.update',
          teamId: team.id,
          stepId: step.id,
          ...(params.name ? { name: params.name } : {}),
          ...(roleId ? { roleId } : {})
        })
      }
      if (params.position !== undefined) {
        state = service.execute({
          kind: 'step.move',
          teamId: team.id,
          stepId: step.id,
          toIndex: params.position - 1
        })
      }
      return { team: teamViewById(state, team.id) }
    }
  }),
  defineMethod({
    name: 'team.stepRemove',
    permission: 'workspace',
    params: AgentTeamStepRefParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const team = resolveTeam(service.getState(), params.teamId)
      const step = resolveStep(team, params.stepId)
      const state = service.execute({ kind: 'step.remove', teamId: team.id, stepId: step.id })
      return { team: teamViewById(state, team.id) }
    }
  }),
  defineMethod({
    name: 'team.seatAdd',
    permission: 'workspace',
    params: AgentTeamSeatAddParams,
    handler: (params) => {
      if (!isTuiAgent(params.agent)) {
        throw new Error(`Unknown agent CLI ${params.agent}; use its Orca id, for example claude.`)
      }
      const service = requireAgentTeamService()
      const team = resolveTeam(service.getState(), params.teamId)
      const step = resolveStep(team, params.stepId)
      const before = service.getState().seats
      const state = service.execute({
        kind: 'seat.add',
        teamId: team.id,
        stepId: step.id,
        agent: params.agent,
        name: params.name ?? `${step.name} ${step.seatIds.length + 1}`,
        ...(params.model ? { model: params.model } : {}),
        ...(params.effort ? { effort: params.effort } : {})
      })
      const seatId = newIdAfter(before, state.seats)
      const seat = state.seats.find((candidate) => candidate.id === seatId)
      return { seat: seat ? seatView(seat) : null, team: teamViewById(state, team.id) }
    }
  }),
  defineMethod({
    name: 'team.seatRetire',
    permission: 'workspace',
    params: AgentTeamSeatRefParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const seat = resolveSeat(service.getState(), params.seatId)
      service.execute({ kind: 'seat.retire', seatId: seat.id })
      return { retired: seat.name }
    }
  })
]
