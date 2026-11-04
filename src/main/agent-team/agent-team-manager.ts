import { composeAgentTeamManagerKickoff } from '../../shared/agent-team/agent-team-manager-prompt'
import { stepRole } from '../../shared/agent-team/agent-team-pipeline'
import type { AgentTeamContext } from '../../shared/agent-team/agent-team-context'
import type { AgentTeamState } from '../../shared/agent-team/agent-team-types'
import type { TuiAgent } from '../../shared/tui-agent'
import type { Store } from '../persistence/loading-store/store'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type { AgentTeamProjectSpecRead } from './agent-team-service'
import { runtimePathsEqual } from '../runtime/runtime-worktree-path-identity'
import {
  agentTeamManagerFolder,
  ensureAgentTeamManagerWorkspace
} from './agent-team-manager-workspace'

/** Everything the Manager needs in one read, so it never guesses ids. */
export async function buildAgentTeamContext(
  state: AgentTeamState,
  repos: Store,
  readSpec: (repoId: string) => Promise<AgentTeamProjectSpecRead>
): Promise<AgentTeamContext> {
  // The Manager's own folder is not a team project.
  const teamRepos = repos
    .getRepos()
    .filter(
      (repo) =>
        repo.id !== state.managerRepoId && !runtimePathsEqual(repo.path, agentTeamManagerFolder())
    )
  const projects = await Promise.all(
    teamRepos.map(async (repo) => ({
      repoId: repo.id,
      name: repo.displayName,
      path: repo.path,
      folder: repo.kind === 'folder',
      tracker: state.projects.find((project) => project.repoId === repo.id)?.tracker ?? null,
      spec: (await readSpec(repo.id).catch(() => null))?.text ?? ''
    }))
  )
  return {
    projects,
    teams: state.teams.map((team) => ({
      id: team.id,
      name: team.name,
      paused: team.paused === true,
      steps: team.steps.map((step, index) => {
        const role = stepRole(team, index, state.roles)
        return {
          name: step.name,
          role: role?.name ?? '?',
          stepType: role?.stepType ?? '?',
          seats: state.seats
            .filter((seat) => step.seatIds.includes(seat.id) && seat.retiredAt === undefined)
            .map((seat) => seat.name)
        }
      })
    })),
    workflow: state.workflow,
    queue: state.issues
      .filter((issue) => issue.status !== 'done' && issue.status !== 'discarded')
      .sort((a, b) => a.priority - b.priority)
      .map((issue) => ({
        id: issue.id,
        repoId: issue.repoId,
        title: issue.title,
        status: issue.status,
        key: issue.tracker?.key ?? null
      }))
  }
}

/** A live Manager session with the same agent, so Start Manager returns to it instead of opening another. */
export async function findLiveManagerSession(
  runtime: OrcaRuntimeService,
  folder: string,
  agent?: TuiAgent
): Promise<{ worktreeId: string; handle: string } | null> {
  const listed = await runtime
    .listTerminals(`path:${folder}`, 50, { requireFreshPtyLiveness: true })
    .catch(() => null)
  const live = (listed?.terminals ?? [])
    .filter(
      (terminal) =>
        terminal.connected &&
        terminal.agentIdentity !== undefined &&
        (agent === undefined || terminal.agentIdentity === agent)
    )
    .sort((a, b) => (b.lastOutputAt ?? 0) - (a.lastOutputAt ?? 0))[0]
  return live ? { worktreeId: live.worktreeId, handle: live.handle } : null
}

/** Opens the Manager in its own Orca-managed folder project, reusing a live session when there is one. */
export async function launchAgentTeamManager(
  runtime: OrcaRuntimeService,
  args: { agent: TuiAgent; request: string; pendingUpdates?: string }
): Promise<{
  worktreeId: string
  terminalHandle: string
  startedNew: boolean
  managerRepoId: string
}> {
  const { folder, repoId } = await ensureAgentTeamManagerWorkspace(runtime)
  const existing = await findLiveManagerSession(runtime, folder, args.agent)
  if (existing) {
    const request = args.request.trim()
    if (request) {
      await runtime.sendTerminalAgentPrompt(existing.handle, request, { inputKind: 'driving' })
    }
    return {
      worktreeId: existing.worktreeId,
      terminalHandle: existing.handle,
      startedNew: false,
      managerRepoId: repoId
    }
  }
  const launched = await runtime.launchAgentTerminal(`path:${folder}`, {
    agent: args.agent,
    prompt: [composeAgentTeamManagerKickoff(args.request), args.pendingUpdates]
      .filter(Boolean)
      .join('\n\n'),
    title: 'Manager',
    suppressStartupUpdatePrompt: true,
    wslUserAct: true
  })
  return {
    worktreeId: launched.worktreeId,
    terminalHandle: launched.handle,
    startedNew: true,
    managerRepoId: repoId
  }
}
