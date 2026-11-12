import type {
  AgentTeamProject,
  AgentTeamRole,
  AgentTeamState
} from '../../shared/agent-team/agent-team-types'
import { projectGroupOfRepo } from '../../shared/agent-team/agent-team-project-groups'
import { projectTracker } from '../../shared/agent-team/agent-team-project-tracker'
import { effectiveProjectSpecStorage } from '../../shared/agent-team/agent-team-spec-storage'
import { getFolderSourceRepos } from '../../shared/folder-workspaces/folder-workspace-source-repos'
import type { ProjectGroup } from '../../shared/project-group-types'
import type { Repo } from '../../shared/repo-types'
import type { AgentTeamService } from './agent-team-service'

/** One item by its id or, when only one has it, its name (any case). */
export function resolveByIdOrName<T>(
  items: readonly T[],
  ref: string,
  id: (item: T) => string,
  name: (item: T) => string,
  noun: string,
  listCommand: string
): T {
  const wanted = ref.trim()
  const byId = items.find((item) => id(item) === wanted)
  if (byId) {
    return byId
  }
  const matches = items.filter((item) => name(item).toLowerCase() === wanted.toLowerCase())
  if (matches.length === 1) {
    return matches[0]
  }
  throw new Error(
    matches.length > 1
      ? `${ref} matches several ${noun}s; pass the id from ${listCommand}.`
      : `No ${noun} ${ref}. Run ${listCommand} to list them.`
  )
}

export function resolveRole(state: AgentTeamState, ref: string): AgentTeamRole {
  return resolveByIdOrName(
    state.roles,
    ref,
    (role) => role.id,
    (role) => role.name,
    'role',
    'orca team roles'
  )
}

function teamRepos(service: AgentTeamService): Repo[] {
  const managerRepoId = service.getState().managerRepoId
  return service.repoCatalog().repos.filter((repo) => repo.id !== managerRepoId)
}

export function resolveRepo(service: AgentTeamService, ref: string): Repo {
  return resolveByIdOrName(
    teamRepos(service),
    ref,
    (repo) => repo.id,
    (repo) => repo.displayName,
    'project',
    'orca team context'
  )
}

/** Orca groups with at least two git repos, the ones a team can work as one project. */
export function resolveGroup(
  service: AgentTeamService,
  ref: string
): { group: ProjectGroup; members: Repo[] } {
  const { projectGroups } = service.repoCatalog()
  const repos = teamRepos(service)
  const groups = projectGroups.flatMap((group) => {
    const members = getFolderSourceRepos(repos, projectGroups, group)
    return members.length > 1 ? [{ group, members }] : []
  })
  return resolveByIdOrName(
    groups,
    ref,
    (entry) => entry.group.id,
    (entry) => entry.group.name,
    'project group',
    'orca team project show'
  )
}

export function roleView(state: AgentTeamState, role: AgentTeamRole) {
  return {
    ...role,
    usedBy: state.teams.flatMap((team) =>
      team.steps
        .filter((step) => step.roleId === role.id)
        .map((step) => ({ teamId: team.id, team: team.name, step: step.name }))
    )
  }
}

export async function projectView(service: AgentTeamService, repo: Repo) {
  const state = service.getState()
  const project = state.projects.find((candidate) => candidate.repoId === repo.id)
  const teamGroup = projectGroupOfRepo(state, repo.id)
  const orcaGroup = teamGroup
    ? service.repoCatalog().projectGroups.find((group) => group.id === teamGroup.groupId)
    : undefined
  const spec = await service.readProjectSpec(repo.id).catch(() => null)
  return {
    repoId: repo.id,
    name: repo.displayName,
    path: repo.path,
    folder: repo.kind === 'folder',
    tracker: projectTracker(project, repo) ?? null,
    /** chosen: set in Team settings; repo: follows the code host; none: switched off. */
    trackerSource: project?.tracker === null ? 'none' : project?.tracker ? 'chosen' : 'repo',
    baseBranch: project?.baseBranch?.trim() || null,
    specStorage: effectiveProjectSpecStorage(project, repo),
    specPath: spec?.path ?? null,
    spec: spec?.text ?? '',
    group: teamGroup
      ? {
          groupId: teamGroup.groupId,
          name: orcaGroup?.name ?? teamGroup.groupId,
          trackerRepoId: teamGroup.trackerRepoId,
          repoIds: teamGroup.repoIds
        }
      : null
  }
}

/** A grouped repo's settings live in the group's tracker repo. */
export function requireConfigRepo(service: AgentTeamService, repo: Repo): void {
  const group = projectGroupOfRepo(service.getState(), repo.id)
  if (group && group.trackerRepoId !== repo.id) {
    const tracker = service.repoCatalog().repos.find((r) => r.id === group.trackerRepoId)
    throw new Error(
      `${repo.displayName} belongs to a group worked as one project; change the settings of its tracker repo ${tracker?.displayName ?? group.trackerRepoId}.`
    )
  }
}

export function trackerPatch(
  project: AgentTeamProject | undefined,
  repo: Repo,
  tracker: string | undefined,
  projectKey: string | undefined
): Pick<AgentTeamProject, 'tracker'> | Record<string, never> {
  if (tracker === undefined && projectKey === undefined) {
    return {}
  }
  if (tracker === 'none') {
    if (projectKey) {
      throw new Error('A project without a tracker has no project key.')
    }
    return { tracker: null }
  }
  if (tracker === 'default' && projectKey === undefined) {
    return { tracker: undefined }
  }
  const provider =
    tracker === 'github' || tracker === 'gitlab' || tracker === 'jira' || tracker === 'linear'
      ? tracker
      : projectTracker(tracker === 'default' ? undefined : project, repo)?.provider
  if (!provider) {
    throw new Error('This project has no tracker; pass --tracker first.')
  }
  const key = projectKey ?? (tracker === undefined ? project?.tracker?.projectKey : undefined)
  return { tracker: { provider, ...(key?.trim() ? { projectKey: key.trim() } : {}) } }
}
