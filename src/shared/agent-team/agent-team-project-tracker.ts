import { splitGitRemoteKey } from '../git/remotes/git-remote-identity'
import type { Repo } from '../repo-types'
import type { TaskProvider } from '../work-items/task-providers'
import type { AgentTeamProject } from './agent-team-types'

export type AgentTeamProjectTracker = NonNullable<AgentTeamProject['tracker']>

/** GitHub or GitLab from the repo's remote host; self-hosted GitLab usually keeps "gitlab" in its host. */
export function trackerFromRepoRemote(
  repo: Pick<Repo, 'gitRemoteIdentity'> | undefined
): TaskProvider | null {
  const host = splitGitRemoteKey(repo?.gitRemoteIdentity?.canonicalKey, (value) => value)?.host
  if (!host) {
    return null
  }
  if (host === 'github.com' || host.includes('github')) {
    return 'github'
  }
  return host.includes('gitlab') ? 'gitlab' : null
}

/** The project's tracker: the one the user chose, otherwise the repo's code host. */
export function projectTracker(
  project: Pick<AgentTeamProject, 'tracker'> | undefined,
  repo: Pick<Repo, 'gitRemoteIdentity'> | undefined
): AgentTeamProjectTracker | undefined {
  if (project?.tracker === null) {
    return undefined
  }
  if (project?.tracker) {
    return project.tracker
  }
  const inferred = trackerFromRepoRemote(repo)
  return inferred ? { provider: inferred } : undefined
}
