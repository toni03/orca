import type { AgentTeamState } from './agent-team-types'

/** A paused seat takes no new steps until it is resumed. */
export type AgentTeamContextSeat = {
  id: string
  name: string
  agent: string
  /** Null runs the agent default model or reasoning level. */
  model: string | null
  effort: string | null
  paused: boolean
}

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
    /** A project group worked as one project: every repo an issue of it gets a worktree in, this one first. */
    groupRepos?: { repoId: string; name: string; path: string }[]
  }[]
  teams: {
    id: string
    name: string
    paused: boolean
    steps: { name: string; role: string; stepType: string; seats: AgentTeamContextSeat[] }[]
  }[]
  workflow: AgentTeamState['workflow']
  queue: { id: string; repoId: string; title: string; status: string; key: string | null }[]
}
