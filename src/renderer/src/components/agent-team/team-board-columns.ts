import { translate } from '@/i18n/i18n'
import { openAssignment, stepRole } from '../../../../shared/agent-team/agent-team-pipeline'
import type { AgentTeamIssue, AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { stepTypeLabel } from './team-labels'

export const ALL_TEAMS = 'all'

export type BoardColumnKind = 'registered' | 'queue' | 'step' | 'needs-you' | 'done'

export type BoardColumn = {
  id: string
  kind: BoardColumnKind
  title: string
  empty: string
  issues: AgentTeamIssue[]
}

/** Board columns for the team filter: queue, one per step (or per step type), Needs you, Done. */
export function boardColumns(
  state: AgentTeamState,
  teamFilter: string,
  visible: readonly AgentTeamIssue[]
): BoardColumn[] {
  const sorted = [...visible].sort((a, b) => a.priority - b.priority)
  const queued = sorted.filter(
    (issue) => issue.status === 'queued' || (issue.status === 'working' && !openAssignment(issue))
  )
  const running = sorted.filter((issue) => issue.status === 'working' && openAssignment(issue))
  const team = state.teams.find((candidate) => candidate.id === teamFilter)
  const stepColumns: BoardColumn[] = team
    ? team.steps.map((step, index) => ({
        id: step.id,
        kind: 'step',
        title: step.name,
        empty: translate('auto.components.agentTeam.TeamBoard.emptyStep', 'Nothing in {{step}}', {
          step: step.name
        }),
        issues: running.filter((issue) => issue.stepIndex === index)
      }))
    : (['build', 'check'] as const).map((stepType) => ({
        id: stepType,
        kind: 'step',
        title: stepTypeLabel(stepType),
        empty:
          stepType === 'build'
            ? translate('auto.components.agentTeam.TeamBoard.emptyBuild', 'Nothing in development')
            : translate('auto.components.agentTeam.TeamBoard.emptyCheck', 'Nothing to review'),
        issues: running.filter((issue) => {
          const issueTeam = state.teams.find((candidate) => candidate.id === issue.teamId)
          return issueTeam
            ? stepRole(issueTeam, issue.stepIndex, state.roles)?.stepType === stepType
            : false
        })
      }))
  const registered = sorted.filter((issue) => issue.status === 'registered')
  return [
    ...(registered.length > 0
      ? [
          {
            id: 'registered',
            kind: 'registered' as const,
            title: translate('auto.components.agentTeam.TeamBoard.notApproved', 'Not approved'),
            empty: '',
            issues: registered
          }
        ]
      : []),
    {
      id: 'queue',
      kind: 'queue',
      title: translate('auto.components.agentTeam.TeamBoard.queue', 'Priority queue'),
      empty: translate('auto.components.agentTeam.TeamBoard.emptyQueue', 'Nothing queued'),
      issues: queued
    },
    ...stepColumns,
    {
      id: 'needs-you',
      kind: 'needs-you',
      title: translate('auto.components.agentTeam.TeamBoard.needsYou', 'Needs you'),
      empty: translate(
        'auto.components.agentTeam.TeamBoard.emptyNeedsYou',
        'Nothing waits for you'
      ),
      issues: sorted.filter((issue) => issue.status === 'needs-you')
    },
    {
      id: 'done',
      kind: 'done',
      title: translate('auto.components.agentTeam.TeamBoard.done', 'Done'),
      empty: '',
      issues: visible
        .filter((issue) => issue.status === 'done')
        .sort((a, b) => b.updatedAt - a.updatedAt)
    }
  ]
}

/** Reads and saves the board view for this user; storage may be unavailable. */
export type BoardPrefs = { groupByProject: boolean; projects: string[] | null }

const PREFS_KEY = 'orca.agentTeam.board'

export function readBoardPrefs(): BoardPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object') {
      const groupByProject = 'groupByProject' in parsed && parsed.groupByProject === true
      const projects =
        'projects' in parsed && Array.isArray(parsed.projects)
          ? parsed.projects.filter((id): id is string => typeof id === 'string')
          : null
      return { groupByProject, projects }
    }
  } catch {
    // Private windows and blocked storage fall back to the default view.
  }
  return { groupByProject: false, projects: null }
}

export function saveBoardPrefs(prefs: BoardPrefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // The view still works; it just is not remembered.
  }
}
