import { composeAgentTeamManagerPrompt } from '../../shared/agent-team/agent-team-manager-prompt'
import { stepRole } from '../../shared/agent-team/agent-team-pipeline'
import type { AgentTeamContext } from '../../shared/agent-team/agent-team-context'
import type { AgentTeamState } from '../../shared/agent-team/agent-team-types'
import type { TuiAgent } from '../../shared/tui-agent'
import type { Store } from '../persistence/loading-store/store'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type { AgentTeamProjectSpecRead } from './agent-team-service'

/** Everything the Manager needs in one read, so it never guesses ids. */
export async function buildAgentTeamContext(
  state: AgentTeamState,
  repos: Store,
  readSpec: (repoId: string) => Promise<AgentTeamProjectSpecRead>
): Promise<AgentTeamContext> {
  const gitRepos = repos.getRepos().filter((repo) => repo.kind !== 'folder')
  const projects = await Promise.all(
    gitRepos.map(async (repo) => ({
      repoId: repo.id,
      name: repo.displayName,
      path: repo.path,
      tracker: state.projects.find((project) => project.repoId === repo.id)?.tracker ?? null,
      spec: (await readSpec(repo.id).catch(() => null))?.text ?? ''
    }))
  )
  return {
    projects,
    teams: state.teams.map((team) => ({
      id: team.id,
      name: team.name,
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

/** Starts the Manager as an agent session in a workspace the user picked. */
export async function launchAgentTeamManager(
  runtime: OrcaRuntimeService,
  args: { worktreeId: string; agent: TuiAgent; request: string }
): Promise<{ worktreeId: string; terminalHandle: string }> {
  const launched = await runtime.launchAgentTerminal(`id:${args.worktreeId}`, {
    agent: args.agent,
    prompt: composeAgentTeamManagerPrompt(args.request),
    title: 'Manager',
    suppressStartupUpdatePrompt: true,
    wslUserAct: true
  })
  return { worktreeId: launched.worktreeId, terminalHandle: launched.handle }
}
