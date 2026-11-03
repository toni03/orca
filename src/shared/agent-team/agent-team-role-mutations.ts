import { BUILTIN_ROLE_TEMPLATES } from './agent-team-builtin-templates'
import { AgentTeamMutationError, type AgentTeamMutationIds } from './agent-team-mutations'
import type { AgentTeamRole, AgentTeamState, AgentTeamStepType } from './agent-team-types'

export function createRole(
  state: AgentTeamState,
  input: { name: string; stepType: AgentTeamStepType; prompt: string },
  ids: AgentTeamMutationIds
): AgentTeamState {
  const role: AgentTeamRole = {
    id: ids.newId(),
    name: input.name.trim() || 'Role',
    stepType: input.stepType,
    prompt: input.prompt,
    skills: [],
    version: 1,
    origin: 'local',
    updatedAt: ids.now
  }
  return { ...state, roles: [...state.roles, role] }
}

export function updateRole(
  state: AgentTeamState,
  roleId: string,
  patch: { name?: string; prompt?: string; skills?: string[]; stepType?: AgentTeamStepType },
  now: number
): AgentTeamState {
  return {
    ...state,
    roles: state.roles.map((role) => {
      if (role.id !== roleId) {
        return role
      }
      const promptChanged = patch.prompt !== undefined && patch.prompt !== role.prompt
      return {
        ...role,
        ...(patch.name?.trim() ? { name: patch.name.trim() } : {}),
        ...(patch.prompt !== undefined ? { prompt: patch.prompt } : {}),
        ...(patch.skills ? { skills: patch.skills.map((s) => s.trim()).filter(Boolean) } : {}),
        ...(patch.stepType ? { stepType: patch.stepType } : {}),
        version: promptChanged ? role.version + 1 : role.version,
        // A changed template copy is the user's own until reset.
        origin: role.origin === 'builtin' ? 'local' : role.origin,
        updatedAt: now
      }
    })
  }
}

export function resetRoleToTemplate(
  state: AgentTeamState,
  roleId: string,
  now: number
): AgentTeamState {
  const role = state.roles.find((candidate) => candidate.id === roleId)
  const template = BUILTIN_ROLE_TEMPLATES.find((candidate) => candidate.id === role?.templateId)
  if (!role || !template) {
    throw new AgentTeamMutationError('This role has no built-in template to reset to.')
  }
  const reset: AgentTeamRole = {
    ...role,
    name: template.name,
    stepType: template.stepType,
    prompt: template.prompt,
    skills: [],
    version: template.prompt === role.prompt ? role.version : role.version + 1,
    origin: 'builtin',
    updatedAt: now
  }
  return {
    ...state,
    roles: state.roles.map((candidate) => (candidate.id === roleId ? reset : candidate))
  }
}

export function deleteRole(state: AgentTeamState, roleId: string): AgentTeamState {
  if (state.teams.some((team) => team.steps.some((step) => step.roleId === roleId))) {
    throw new AgentTeamMutationError('A team step uses this role; change that step first.')
  }
  return { ...state, roles: state.roles.filter((role) => role.id !== roleId) }
}
