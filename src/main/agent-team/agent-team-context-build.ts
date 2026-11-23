import { stepRole } from '../../shared/agent-team/agent-team-pipeline'
import type { AgentTeamContext } from '../../shared/agent-team/agent-team-context'
import {
  linkedRepoIds,
  projectGroupOfRepo,
  teamProjectRepoId
} from '../../shared/agent-team/agent-team-project-groups'
import { projectTracker } from '../../shared/agent-team/agent-team-project-tracker'
import type { AgentTeamIssue, AgentTeamState } from '../../shared/agent-team/agent-team-types'
import { describeWaiting } from '../../shared/agent-team/agent-team-wait-reason'
import type { Store } from '../persistence/loading-store/store'
import type { Repo } from '../../shared/repository/repo-types'
import type { AgentTeamProjectSpecRead } from './agent-team-service'
import { isPathInsideOrEqual } from '../../shared/file-access/cross-platform-path'
import { botsRootFolder } from '../bots/bot-home'

/** Bot homes (the Manager's among them) are not team projects. */
export function isAgentTeamProjectRepo(repo: Pick<Repo, 'path'>): boolean {
  return !isPathInsideOrEqual(botsRootFolder(), repo.path)
}

/** Everything the Manager needs in one read, so it never guesses ids. */
export async function buildAgentTeamContext(
  state: AgentTeamState,
  repos: Store,
  readSpec: (repoId: string) => Promise<AgentTeamProjectSpecRead>
): Promise<AgentTeamContext> {
  const teamRepos = repos.getRepos().filter(isAgentTeamProjectRepo)
  // A group's other repos are not projects of their own: their issues belong to the tracker repo.
  const waiting = describeWaiting(state)
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
              model: seat.model ?? null,
              effort: seat.effort ?? null,
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
        teamId: issue.teamId,
        title: issue.title,
        status: issue.status,
        key: issue.tracker?.key ?? null,
        ...issueStep(state, issue),
        needsYou: issue.status === 'needs-you' ? (issue.needsYou?.reason ?? null) : null,
        round: issue.round,
        waiting: waiting[issue.id] ?? null
      }))
  }
}

function issueStep(
  state: AgentTeamState,
  issue: AgentTeamIssue
): Pick<AgentTeamContext['queue'][number], 'step' | 'stepType'> {
  const team = state.teams.find((candidate) => candidate.id === issue.teamId)
  const step = team?.steps[issue.stepIndex]
  if (!team || !step) {
    return { step: null, stepType: null }
  }
  return {
    step: step.name,
    stepType: stepRole(team, issue.stepIndex, state.roles)?.stepType ?? null
  }
}
