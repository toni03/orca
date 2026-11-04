import type { AgentTeamProject, AgentTeamProjectSpecStorage } from './agent-team-types'

/** Remote checkouts are not readable from this computer, so their spec always lives locally. */
export function effectiveProjectSpecStorage(
  project: Pick<AgentTeamProject, 'specStorage'> | undefined,
  repo: { connectionId?: string | null } | undefined
): AgentTeamProjectSpecStorage {
  return repo?.connectionId ? 'local' : (project?.specStorage ?? 'repository')
}
