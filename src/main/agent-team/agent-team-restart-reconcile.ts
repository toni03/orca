import { openAssignment } from '../../shared/agent-team/agent-team-pipeline'
import type { AgentTeamAssignment, AgentTeamState } from '../../shared/agent-team/agent-team-types'
import type { AgentTeamLauncher } from './agent-team-launcher'

type ReconcileDeps = {
  state: () => AgentTeamState
  launcher: Pick<AgentTeamLauncher, 'liveTerminals' | 'watchExit'>
  stopAssignment: (
    assignmentId: string,
    reason: NonNullable<AgentTeamAssignment['stopReason']>,
    detail: string
  ) => void
}

/** After a restart, re-watch sessions that survived and hand the rest to the user. */
export async function reconcileAgentTeamSessionsAfterRestart(deps: ReconcileDeps): Promise<void> {
  const open = deps
    .state()
    .issues.map((issue) => openAssignment(issue))
    .filter((assignment) => assignment !== undefined)
  if (open.length === 0) {
    return
  }
  for (const assignment of open.filter((candidate) => !candidate.terminalHandle)) {
    deps.stopAssignment(assignment.id, 'launch-failed', 'Orca closed before the session started.')
  }
  const withTerminal = open.filter((candidate) => candidate.terminalHandle)
  const handles = withTerminal.flatMap((candidate) =>
    candidate.terminalHandle ? [candidate.terminalHandle] : []
  )
  if (handles.length === 0) {
    return
  }
  const live = await deps.launcher.liveTerminals(handles)
  // Unknown liveness must not fail sessions that may still be working.
  if (!live) {
    return
  }
  for (const assignment of withTerminal) {
    const handle = assignment.terminalHandle
    if (!handle) {
      continue
    }
    const stop = (): void =>
      deps.stopAssignment(assignment.id, 'exited', 'The session ended while Orca was closed.')
    if (live.has(handle)) {
      deps.launcher.watchExit(handle, stop, live.get(handle) ?? undefined)
    } else {
      stop()
    }
  }
}
