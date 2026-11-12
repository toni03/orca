import { defineMethod } from '../../core'
import {
  AgentTeamGroupRefParams,
  AgentTeamGroupUpdateParams,
  AgentTeamProjectShowParams,
  AgentTeamProjectUpdateParams,
  AgentTeamRoleCreateParams,
  AgentTeamRoleListParams,
  AgentTeamRoleRefParams,
  AgentTeamRoleUpdateParams,
  AgentTeamSeatUpdateParams
} from '../../../../../shared/rpc-contract/agent-team-params'
import type { AgentTeamProject } from '../../../../../shared/agent-team/agent-team-types'
import { projectTracker } from '../../../../../shared/agent-team/agent-team-project-tracker'
import { effectiveProjectSpecStorage } from '../../../../../shared/agent-team/agent-team-spec-storage'
import {
  projectView,
  requireConfigRepo,
  resolveByIdOrName,
  resolveGroup,
  resolveRepo,
  resolveRole,
  resolveSeat,
  roleView,
  trackerPatch
} from '../../../../agent-team/agent-team-config-views'
import { requireAgentTeamService } from '../../../../agent-team/agent-team-service-registry'

export const AGENT_TEAM_CONFIG_METHODS = [
  defineMethod({
    name: 'team.seatUpdate',
    permission: 'workspace',
    params: AgentTeamSeatUpdateParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const seatId = resolveSeat(service.getState(), params.seatId).id
      const state = service.execute({
        kind: 'seat.update',
        seatId,
        ...(params.name !== undefined ? { name: params.name } : {}),
        ...(params.model !== undefined ? { model: params.model } : {}),
        ...(params.effort !== undefined ? { effort: params.effort } : {}),
        ...(params.instructions !== undefined ? { instructions: params.instructions } : {})
      })
      return { seat: state.seats.find((seat) => seat.id === seatId) ?? null }
    }
  }),
  defineMethod({
    name: 'team.roles',
    permission: 'workspace',
    params: AgentTeamRoleListParams,
    handler: (params) => {
      const state = requireAgentTeamService().getState()
      const roles = params.roleId ? [resolveRole(state, params.roleId)] : state.roles
      return { roles: roles.map((role) => roleView(state, role)) }
    }
  }),
  defineMethod({
    name: 'team.roleCreate',
    permission: 'workspace',
    params: AgentTeamRoleCreateParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const before = new Set(service.getState().roles.map((role) => role.id))
      let state = service.execute({
        kind: 'role.create',
        name: params.name,
        stepType: params.stepType,
        prompt: params.prompt ?? ''
      })
      const created = state.roles.find((role) => !before.has(role.id))
      if (created && params.skills && params.skills.length > 0) {
        state = service.execute({ kind: 'role.update', roleId: created.id, skills: params.skills })
      }
      const role = created && state.roles.find((candidate) => candidate.id === created.id)
      return { role: role ? roleView(state, role) : null }
    }
  }),
  defineMethod({
    name: 'team.roleUpdate',
    permission: 'workspace',
    params: AgentTeamRoleUpdateParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const roleId = resolveRole(service.getState(), params.roleId).id
      const state = service.execute({
        kind: 'role.update',
        roleId,
        ...(params.name !== undefined ? { name: params.name } : {}),
        ...(params.stepType ? { stepType: params.stepType } : {}),
        ...(params.prompt !== undefined ? { prompt: params.prompt } : {}),
        ...(params.skills ? { skills: params.skills } : {})
      })
      const role = state.roles.find((candidate) => candidate.id === roleId)
      return { role: role ? roleView(state, role) : null }
    }
  }),
  defineMethod({
    name: 'team.roleReset',
    permission: 'workspace',
    params: AgentTeamRoleRefParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const roleId = resolveRole(service.getState(), params.roleId).id
      const state = service.execute({ kind: 'role.reset', roleId })
      const role = state.roles.find((candidate) => candidate.id === roleId)
      return { role: role ? roleView(state, role) : null }
    }
  }),
  defineMethod({
    name: 'team.roleDelete',
    permission: 'workspace',
    params: AgentTeamRoleRefParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const role = resolveRole(service.getState(), params.roleId)
      if (role.templateId) {
        throw new Error(`${role.name} comes from a template; reset it instead of deleting it.`)
      }
      service.execute({ kind: 'role.delete', roleId: role.id })
      return { deleted: role.name }
    }
  }),
  defineMethod({
    name: 'team.projectShow',
    permission: 'workspace',
    params: AgentTeamProjectShowParams,
    handler: async (params) => {
      const service = requireAgentTeamService()
      return { project: await projectView(service, resolveRepo(service, params.repoId)) }
    }
  }),
  defineMethod({
    name: 'team.projectUpdate',
    permission: 'workspace',
    params: AgentTeamProjectUpdateParams,
    handler: async (params) => {
      const service = requireAgentTeamService()
      const repo = resolveRepo(service, params.repoId)
      requireConfigRepo(service, repo)
      const project = service.getState().projects.find((candidate) => candidate.repoId === repo.id)
      if (
        params.specStorage === 'repository' &&
        effectiveProjectSpecStorage({ specStorage: 'repository' }, repo) === 'local'
      ) {
        throw new Error('A project on a remote host keeps its spec in Orca (--spec-storage local).')
      }
      const patch: Partial<Omit<AgentTeamProject, 'repoId'>> = {
        ...trackerPatch(project, repo, params.tracker, params.projectKey),
        ...(params.baseBranch !== undefined ? { baseBranch: params.baseBranch ?? undefined } : {}),
        ...(params.specStorage ? { specStorage: params.specStorage } : {})
      }
      if (Object.keys(patch).length > 0) {
        service.execute({ kind: 'project.update', repoId: repo.id, patch })
      }
      // After the patch, so the spec lands in the storage just chosen.
      if (params.spec !== undefined) {
        await service.writeProjectSpec(repo.id, params.spec)
      }
      return { project: await projectView(service, repo) }
    }
  }),
  defineMethod({
    name: 'team.groupUpdate',
    permission: 'workspace',
    params: AgentTeamGroupUpdateParams,
    handler: async (params) => {
      const service = requireAgentTeamService()
      const { group, members } = resolveGroup(service, params.groupId)
      const memberRef = (ref: string): string =>
        resolveByIdOrName(
          members,
          ref,
          (repo) => repo.id,
          (repo) => repo.displayName,
          `repo of ${group.name}`,
          'orca team project show'
        ).id
      const current = service.getState().groups?.find((other) => other.groupId === group.id)
      const repoIds = params.repoIds
        ? params.repoIds.map(memberRef)
        : (current?.repoIds ?? members.map((repo) => repo.id))
      const trackerRepoId = params.trackerRepoId
        ? memberRef(params.trackerRepoId)
        : (current?.trackerRepoId ??
          (members.find((repo) => projectTracker(undefined, repo)) ?? members[0]).id)
      service.execute({
        kind: 'group.update',
        group: {
          groupId: group.id,
          trackerRepoId,
          repoIds: [...new Set([trackerRepoId, ...repoIds])]
        }
      })
      const tracker = members.find((repo) => repo.id === trackerRepoId)
      return { project: tracker ? await projectView(service, tracker) : null }
    }
  }),
  defineMethod({
    name: 'team.groupRemove',
    permission: 'workspace',
    params: AgentTeamGroupRefParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const { group } = resolveGroup(service, params.groupId)
      service.execute({ kind: 'group.remove', groupId: group.id })
      return { removed: group.name }
    }
  })
]
