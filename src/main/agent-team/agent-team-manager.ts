import type { AgentTeamManagerSession } from '../../shared/agent-team/agent-team-ipc'
import { makePaneKey } from '../../shared/workspace-layout/stable-pane-id'
import { isTuiAgent } from '../../shared/agent-launch/catalog/tui-agent-config'
import { composeAgentTeamManagerKickoff } from '../../shared/agent-team/agent-team-manager-prompt'
import { stepRole } from '../../shared/agent-team/agent-team-pipeline'
import type { AgentTeamContext } from '../../shared/agent-team/agent-team-context'
import {
  linkedRepoIds,
  projectGroupOfRepo,
  teamProjectRepoId
} from '../../shared/agent-team/agent-team-project-groups'
import { projectTracker } from '../../shared/agent-team/agent-team-project-tracker'
import type { AgentTeamState } from '../../shared/agent-team/agent-team-types'
import type { TuiAgent } from '../../shared/agent-launch/catalog/tui-agent'
import type { Store } from '../persistence/loading-store/store'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type { AgentTeamProjectSpecRead } from './agent-team-service'
import { runtimePathsEqual } from '../runtime/workspaces/catalog/runtime-worktree-path-identity'
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
  // A group's other repos are not projects of their own: their issues belong to the tracker repo.
  const projectRepos = teamRepos.filter((repo) => teamProjectRepoId(state, repo.id) === repo.id)
  const projects = await Promise.all(
    projectRepos.map(async (repo) => {
      const project = state.projects.find((candidate) => candidate.repoId === repo.id)
      const group = projectGroupOfRepo(state, repo.id)
      const groupRepos = group
        ? [repo.id, ...linkedRepoIds(state, repo.id)].flatMap((repoId) => {
            const member = teamRepos.find((candidate) => candidate.id === repoId)
            return member ? [{ repoId, name: member.displayName, path: member.path }] : []
          })
        : []
      return {
        repoId: repo.id,
        name: repo.displayName,
        path: repo.path,
        folder: repo.kind === 'folder',
        tracker: projectTracker(project, repo) ?? null,
        baseBranch: project?.baseBranch?.trim() || null,
        spec: (await readSpec(repo.id).catch(() => null))?.text ?? '',
        ...(groupRepos.length > 1 ? { groupRepos } : {})
      }
    })
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
            .map((seat) => ({
              id: seat.id,
              name: seat.name,
              agent: seat.agent,
              paused: seat.paused === true
            }))
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
): Promise<AgentTeamManagerSession | null> {
  const listed = await runtime
    .listTerminals(`path:${folder}`, 50, { requireFreshPtyLiveness: true })
    .catch(() => null)
  const live = (listed?.terminals ?? [])
    .filter(
      (terminal) =>
        terminal.connected &&
        isTuiAgent(terminal.agentIdentity) &&
        (agent === undefined || terminal.agentIdentity === agent)
    )
    .sort((a, b) => (b.lastOutputAt ?? 0) - (a.lastOutputAt ?? 0))[0]
  if (!live || !isTuiAgent(live.agentIdentity)) {
    return null
  }
  return {
    worktreeId: live.worktreeId,
    terminalHandle: live.handle,
    tabId: live.tabId,
    paneKey: makePaneKey(live.tabId, live.leafId),
    ptyId: live.ptyId,
    agent: live.agentIdentity
  }
}

/** Opens the Manager in its own Orca-managed folder project, reusing a live session when there is one. */
export async function launchAgentTeamManager(
  runtime: OrcaRuntimeService,
  args: { agent: TuiAgent; request: string; pendingUpdates?: string }
): Promise<{ session: AgentTeamManagerSession; startedNew: boolean; managerRepoId: string }> {
  const { folder, repoId } = await ensureAgentTeamManagerWorkspace(runtime)
  const existing = await findLiveManagerSession(runtime, folder, args.agent)
  if (existing) {
    const request = args.request.trim()
    if (request) {
      await runtime.sendTerminalAgentPrompt(existing.terminalHandle, request, {
        inputKind: 'driving'
      })
    }
    return { session: existing, startedNew: false, managerRepoId: repoId }
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
    session: {
      worktreeId: launched.worktreeId,
      terminalHandle: launched.handle,
      tabId: launched.tabId ?? null,
      paneKey: launched.paneKey ?? null,
      ptyId: launched.ptyId ?? null,
      agent: args.agent
    },
    startedNew: true,
    managerRepoId: repoId
  }
}
