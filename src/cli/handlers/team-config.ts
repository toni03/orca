import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { AgentTeamRole } from '../../shared/agent-team/agent-team-types'
import type { CommandHandler } from '../dispatch'
import {
  getOptionalStringFlag,
  getOptionalStringFlagAllowingEmpty,
  getRepeatedStringFlag,
  getRequiredStringFlag
} from '../flags'
import { printResult } from '../format'

type RoleView = AgentTeamRole & { usedBy: { teamId: string; team: string; step: string }[] }

type ProjectView = {
  repoId: string
  name: string
  path: string
  folder: boolean
  tracker: { provider: string; projectKey?: string } | null
  trackerSource: 'chosen' | 'repo' | 'none'
  baseBranch: string | null
  specStorage: 'repository' | 'local'
  specPath: string | null
  spec: string
  group: { groupId: string; name: string; trackerRepoId: string; repoIds: string[] } | null
}

function roleLine(role: RoleView): string {
  const used =
    role.usedBy.length > 0
      ? role.usedBy.map((use) => `${use.team} › ${use.step}`).join(', ')
      : 'unused'
  return `${role.id}  ${role.name}  [${role.stepType}]  v${role.version}  ${role.origin}  ${used}`
}

function formatRole(role: RoleView): string {
  return [
    roleLine(role),
    `Skills: ${role.skills.length > 0 ? role.skills.join(', ') : 'none'}`,
    '',
    role.prompt || '(empty prompt)'
  ].join('\n')
}

function formatProject(project: ProjectView): string {
  const key = project.tracker?.projectKey ? ` ${project.tracker.projectKey}` : ''
  const source = project.trackerSource === 'repo' ? ' (repo default)' : ''
  const lines = [
    `${project.repoId}  ${project.name}  ${project.path}${project.folder ? '  (folder)' : ''}`,
    `Tracker: ${project.tracker ? `${project.tracker.provider}${key}${source}` : 'none'}`,
    `Base branch: ${project.baseBranch ?? 'repo default'}`,
    `Spec: ${project.specStorage}${project.specPath ? ` (${project.specPath})` : ''}`
  ]
  if (project.group) {
    lines.push(
      `Group: ${project.group.name} (${project.group.groupId}), tracker repo ${project.group.trackerRepoId}, repos ${project.group.repoIds.join(', ')}`
    )
  }
  return [...lines, '', project.spec || '(empty spec)'].join('\n')
}

/** --<name> and --<name>-file are one input; the file path is relative to where the CLI runs. */
async function readTextFlag(
  flags: Map<string, string | boolean>,
  name: string,
  cwd: string
): Promise<string | undefined> {
  const text = getOptionalStringFlagAllowingEmpty(flags, name)
  const file = getOptionalStringFlag(flags, `${name}-file`)
  if (text !== undefined && file !== undefined) {
    throw new Error(`Pass --${name} or --${name}-file, not both.`)
  }
  return file !== undefined ? readFile(resolve(cwd, file), 'utf8') : text
}

function stepTypeFlag(flags: Map<string, string | boolean>): 'build' | 'check' | undefined {
  const type = getOptionalStringFlag(flags, 'type')
  if (type !== undefined && type !== 'build' && type !== 'check') {
    throw new Error('--type must be build or check.')
  }
  return type
}

/** Team settings from the CLI: roles, project settings and project groups. */
export const TEAM_CONFIG_HANDLERS: Record<string, CommandHandler> = {
  'team roles': async ({ client, json }) => {
    const response = await client.call<{ roles: RoleView[] }>('team.roles', {})
    printResult(response, json, (result) => result.roles.map(roleLine).join('\n') || 'No roles.')
  },
  'team role show': async ({ flags, client, json }) => {
    const response = await client.call<{ roles: RoleView[] }>('team.roles', {
      roleId: getRequiredStringFlag(flags, 'role')
    })
    printResult(response, json, (result) => result.roles.map(formatRole).join('\n\n'))
  },
  'team role create': async ({ flags, client, cwd, json }) => {
    const prompt = await readTextFlag(flags, 'prompt', cwd)
    const skills = getRepeatedStringFlag(flags, 'skill')
    const stepType = stepTypeFlag(flags)
    if (!stepType) {
      throw new Error('Missing --type (build or check).')
    }
    const response = await client.call<{ role: RoleView | null }>('team.roleCreate', {
      name: getRequiredStringFlag(flags, 'name'),
      stepType,
      ...(prompt !== undefined ? { prompt } : {}),
      ...(skills.length > 0 ? { skills } : {})
    })
    printResult(response, json, (result) =>
      result.role ? `Created ${roleLine(result.role)}` : 'Created.'
    )
  },
  'team role update': async ({ flags, client, cwd, json }) => {
    const name = getOptionalStringFlag(flags, 'name')
    const prompt = await readTextFlag(flags, 'prompt', cwd)
    const skills = getRepeatedStringFlag(flags, 'skill')
    const clearSkills = flags.get('no-skills') === true
    if (clearSkills && skills.length > 0) {
      throw new Error('Pass --skill or --no-skills, not both.')
    }
    const stepType = stepTypeFlag(flags)
    const response = await client.call<{ role: RoleView | null }>('team.roleUpdate', {
      roleId: getRequiredStringFlag(flags, 'role'),
      ...(name !== undefined ? { name } : {}),
      ...(stepType ? { stepType } : {}),
      ...(prompt !== undefined ? { prompt } : {}),
      ...(skills.length > 0 || clearSkills ? { skills } : {})
    })
    printResult(response, json, (result) =>
      result.role ? `Updated ${roleLine(result.role)}` : 'Updated.'
    )
  },
  'team role reset': async ({ flags, client, json }) => {
    const response = await client.call<{ role: RoleView | null }>('team.roleReset', {
      roleId: getRequiredStringFlag(flags, 'role')
    })
    printResult(response, json, (result) =>
      result.role ? `Reset ${roleLine(result.role)}` : 'Reset.'
    )
  },
  'team role delete': async ({ flags, client, json }) => {
    const response = await client.call<{ deleted: string }>('team.roleDelete', {
      roleId: getRequiredStringFlag(flags, 'role')
    })
    printResult(response, json, (result) => `Deleted ${result.deleted}.`)
  },
  'team project show': async ({ flags, client, json }) => {
    const response = await client.call<{ project: ProjectView }>('team.projectShow', {
      repoId: getRequiredStringFlag(flags, 'repo')
    })
    printResult(response, json, (result) => formatProject(result.project))
  },
  'team project update': async ({ flags, client, cwd, json }) => {
    const tracker = getOptionalStringFlag(flags, 'tracker')
    const projectKey = getOptionalStringFlagAllowingEmpty(flags, 'project-key')
    const baseBranch = getOptionalStringFlag(flags, 'base-branch')
    const defaultBranch = flags.get('default-branch') === true
    if (baseBranch !== undefined && defaultBranch) {
      throw new Error('Pass --base-branch or --default-branch, not both.')
    }
    const specStorage = getOptionalStringFlag(flags, 'spec-storage')
    const spec = await readTextFlag(flags, 'spec', cwd)
    const response = await client.call<{ project: ProjectView }>('team.projectUpdate', {
      repoId: getRequiredStringFlag(flags, 'repo'),
      ...(tracker !== undefined ? { tracker } : {}),
      ...(projectKey !== undefined ? { projectKey } : {}),
      ...(baseBranch !== undefined || defaultBranch ? { baseBranch: baseBranch ?? null } : {}),
      ...(specStorage !== undefined ? { specStorage } : {}),
      ...(spec !== undefined ? { spec } : {})
    })
    printResult(response, json, (result) => `Updated\n${formatProject(result.project)}`)
  },
  'team group update': async ({ flags, client, json }) => {
    const trackerRepoId = getOptionalStringFlag(flags, 'tracker-repo')
    const repoIds = getRepeatedStringFlag(flags, 'repo')
    const response = await client.call<{ project: ProjectView | null }>('team.groupUpdate', {
      groupId: getRequiredStringFlag(flags, 'group'),
      ...(trackerRepoId !== undefined ? { trackerRepoId } : {}),
      ...(repoIds.length > 0 ? { repoIds } : {})
    })
    printResult(response, json, (result) =>
      result.project ? `Updated\n${formatProject(result.project)}` : 'Updated.'
    )
  },
  'team group remove': async ({ flags, client, json }) => {
    const response = await client.call<{ removed: string }>('team.groupRemove', {
      groupId: getRequiredStringFlag(flags, 'group')
    })
    printResult(response, json, (result) => `${result.removed} is no longer worked as one project.`)
  }
}
