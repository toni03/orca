import type { Repo } from '../repo-types'
import { getRepoRoutingConnectionId } from '../execution-host'
import type { AgentTeamProject, AgentTeamProjectSpecStorage } from './agent-team-types'

/** Remote checkouts are not readable from this computer, so their spec always lives locally. */
export function effectiveProjectSpecStorage(
  project: Pick<AgentTeamProject, 'specStorage'> | undefined,
  repo: Pick<Repo, 'connectionId' | 'executionHostId'> | undefined | null
): AgentTeamProjectSpecStorage {
  return repo && getRepoRoutingConnectionId(repo) ? 'local' : (project?.specStorage ?? 'repository')
}
