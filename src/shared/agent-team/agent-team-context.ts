import type { AgentTeamState } from './agent-team-types'

/** What `orca team context` returns: everything the Manager needs in one read. */
export type AgentTeamContext = {
  projects: {
    repoId: string
    name: string
    path: string
    tracker: AgentTeamState['projects'][number]['tracker'] | null
    /** Folder projects run one issue at a time, in the folder itself. */
    folder: boolean
    /** Branch issue worktrees start from and merge requests target; null is the repo default. */
    baseBranch: string | null
    spec: string
  }[]
  teams: {
    id: string
    name: string
    paused: boolean
    steps: { name: string; role: string; stepType: string; seats: string[] }[]
  }[]
  workflow: AgentTeamState['workflow']
  queue: { id: string; repoId: string; title: string; status: string; key: string | null }[]
}
