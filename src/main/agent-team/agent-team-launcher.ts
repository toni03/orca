import type {
  AgentTeamAssignment,
  AgentTeamIssue,
  AgentTeamProject,
  AgentTeamSeat
} from '../../shared/agent-team/agent-team-types'

/** What the engine needs from Orca to start and end a seat's session. */
export type AgentTeamLauncher = {
  /** Exact path of this app's CLI for report commands; null keeps the bare `orca`. */
  cliCommand(): string | null
  /** Folder projects have no git, so seats work in place and never open merge requests. */
  isFolderProject(repoId: string): boolean
  /** Build step without a worktree yet: create one from the base branch and start the agent in it. */
  launchInNewWorktree(args: {
    repoId: string
    name: string
    baseBranch?: string
    seat: AgentTeamSeat
    prompt: string
    title: string
  }): Promise<{ worktreeId: string; branch?: string; terminalHandle: string }>
  /** Any later step: start the agent in the issue's worktree. */
  launchInWorktree(args: {
    worktreeId: string
    seat: AgentTeamSeat
    prompt: string
    title: string
  }): Promise<{ terminalHandle: string }>
  readProjectSpec(project: AgentTeamProject | undefined, repoId: string): Promise<string | null>
  /** Resolves when the session's process exits; ptyId adopts a session started before a restart. */
  watchExit(terminalHandle: string, onExit: () => void, ptyId?: string): void
  /** Live terminals among these handles with their PTY ids; null when liveness cannot be read. */
  liveTerminals(handles: string[]): Promise<Map<string, string | null> | null>
  /** Types the user's answer into a session that is waiting for input. */
  sendToSession(terminalHandle: string, text: string): Promise<void>
  /** Closes a session whose step is over; its transcript stays with the agent CLI. */
  closeSession(terminalHandle: string): Promise<void>
  /** Removes the worktree of an issue that is done or discarded. */
  removeWorktree(worktreeId: string): Promise<void>
}

export function agentTeamWorktreeName(issue: AgentTeamIssue): string {
  const key = (issue.tracker?.key ?? issue.id.slice(0, 8)).replace(/[^A-Za-z0-9]+/g, '')
  const slug = issue.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return [key.toLowerCase(), slug].filter(Boolean).join('-') || `team-${issue.id.slice(0, 8)}`
}

/** The step is over: its record lives in the issue history and the tracker, not an open tab. */
export function closeAgentTeamSession(
  launcher: AgentTeamLauncher,
  assignment: AgentTeamAssignment
): void {
  if (assignment.terminalHandle) {
    void launcher.closeSession(assignment.terminalHandle).catch(() => undefined)
  }
}

/** A done or discarded issue no longer needs its worktree; folder projects keep their folder. */
export function removeFinishedAgentTeamWorktree(
  launcher: AgentTeamLauncher,
  issue: AgentTeamIssue
): void {
  const finished = issue.status === 'done' || issue.status === 'discarded'
  if (finished && issue.worktreeId && !launcher.isFolderProject(issue.repoId)) {
    void launcher.removeWorktree(issue.worktreeId).catch(() => undefined)
  }
}
