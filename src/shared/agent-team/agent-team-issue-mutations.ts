import {
  AgentTeamMutationError,
  requireTeam,
  type AgentTeamMutationIds
} from './agent-team-mutations'
import type {
  AgentTeamIssue,
  AgentTeamIssueScope,
  AgentTeamProject,
  AgentTeamState,
  AgentTeamTrackerRef,
  AgentTeamWorkflow
} from './agent-team-types'

export function upsertProject(
  state: AgentTeamState,
  repoId: string,
  patch: Partial<Omit<AgentTeamProject, 'repoId'>>
): AgentTeamState {
  const existing = state.projects.find((project) => project.repoId === repoId)
  const next: AgentTeamProject = { repoId, specStorage: 'repository', ...existing, ...patch }
  return {
    ...state,
    projects: existing
      ? state.projects.map((project) => (project.repoId === repoId ? next : project))
      : [...state.projects, next]
  }
}

export type AgentTeamIssueInput = {
  repoId: string
  teamId: string
  title: string
  body?: string
  criteria?: string[]
  scope?: AgentTeamIssueScope
  dependsOn?: string[]
  tracker?: AgentTeamTrackerRef
  /** Approved issues join the queue right away. */
  approved?: boolean
}

export function createIssue(
  state: AgentTeamState,
  input: AgentTeamIssueInput,
  ids: AgentTeamMutationIds
): {
  state: AgentTeamState
  issue: AgentTeamIssue
} {
  requireTeam(state, input.teamId)
  const title = input.title.trim()
  if (!title) {
    throw new AgentTeamMutationError('An issue needs a title.')
  }
  const unknownDependency = input.dependsOn?.find(
    (id) => !state.issues.some((issue) => issue.id === id)
  )
  if (unknownDependency) {
    throw new AgentTeamMutationError(`No issue ${unknownDependency} to depend on.`)
  }
  const issue: AgentTeamIssue = {
    id: ids.newId(),
    repoId: input.repoId,
    teamId: input.teamId,
    title,
    body: input.body?.trim() ?? '',
    criteria: (input.criteria ?? []).map((c) => c.trim()).filter(Boolean),
    ...(input.tracker ? { tracker: input.tracker } : {}),
    status: input.approved ? 'queued' : 'registered',
    priority: Math.max(0, ...state.issues.map((candidate) => candidate.priority)) + 1,
    scope: input.scope ?? 'shared',
    dependsOn: input.dependsOn ?? [],
    stepIndex: 0,
    round: 1,
    assignments: [],
    createdAt: ids.now,
    updatedAt: ids.now
  }
  return { state: { ...state, issues: [...state.issues, issue] }, issue }
}

export function approveIssues(
  state: AgentTeamState,
  issueIds: readonly string[],
  now: number
): AgentTeamState {
  const wanted = new Set(issueIds)
  return {
    ...state,
    issues: state.issues.map((issue) =>
      wanted.has(issue.id) && issue.status === 'registered'
        ? { ...issue, status: 'queued', updatedAt: now }
        : issue
    )
  }
}

/** Puts the given issues first, in this order; the rest keep their relative order. */
export function reorderQueue(
  state: AgentTeamState,
  orderedIssueIds: readonly string[]
): AgentTeamState {
  const rank = new Map(orderedIssueIds.map((id, index) => [id, index]))
  const sorted = [...state.issues].sort((a, b) => {
    const ra = rank.get(a.id)
    const rb = rank.get(b.id)
    if (ra !== undefined || rb !== undefined) {
      return (ra ?? Number.MAX_SAFE_INTEGER) - (rb ?? Number.MAX_SAFE_INTEGER)
    }
    return a.priority - b.priority
  })
  const priority = new Map(sorted.map((issue, index) => [issue.id, index + 1]))
  return {
    ...state,
    issues: state.issues.map((issue) => ({
      ...issue,
      priority: priority.get(issue.id) ?? issue.priority
    }))
  }
}

/** Puts queued issues that have not started back in Not approved, so no seat takes them. */
export function holdIssues(
  state: AgentTeamState,
  issueIds: readonly string[],
  now: number
): AgentTeamState {
  for (const id of issueIds) {
    const issue = requireIssue(state, id)
    if (issue.status !== 'queued' && issue.status !== 'registered') {
      throw new AgentTeamMutationError(
        `Issue ${id} is ${issue.status}; only queued issues that have not started can be held.`
      )
    }
  }
  const wanted = new Set(issueIds)
  return {
    ...state,
    issues: state.issues.map((issue) =>
      wanted.has(issue.id) && issue.status === 'queued'
        ? { ...issue, status: 'registered', updatedAt: now }
        : issue
    )
  }
}

function requireIssue(state: AgentTeamState, issueId: string): AgentTeamIssue {
  const issue = state.issues.find((candidate) => candidate.id === issueId)
  if (!issue) {
    throw new AgentTeamMutationError(`No issue ${issueId}.`)
  }
  return issue
}

/** Rejects unknown issues, the issue itself, and any dependency that already waits on it. */
function checkDependencies(
  state: AgentTeamState,
  issueId: string,
  dependsOn: readonly string[]
): void {
  const byId = new Map(state.issues.map((issue) => [issue.id, issue]))
  for (const id of dependsOn) {
    if (id === issueId) {
      throw new AgentTeamMutationError('An issue cannot depend on itself.')
    }
    if (!byId.has(id)) {
      throw new AgentTeamMutationError(`No issue ${id} to depend on.`)
    }
  }
  const pending = [...dependsOn]
  const seen = new Set<string>()
  while (pending.length > 0) {
    const id = pending.pop()!
    if (id === issueId) {
      throw new AgentTeamMutationError(
        'These dependencies would make the issues wait on each other.'
      )
    }
    if (!seen.has(id)) {
      seen.add(id)
      pending.push(...(byId.get(id)?.dependsOn ?? []))
    }
  }
}

export function updateIssueDetails(
  state: AgentTeamState,
  issueId: string,
  patch: {
    title?: string
    body?: string
    criteria?: string[]
    scope?: AgentTeamIssueScope
    tracker?: AgentTeamTrackerRef
    dependsOn?: string[]
  },
  now: number
): AgentTeamState {
  requireIssue(state, issueId)
  const dependsOn = patch.dependsOn ? [...new Set(patch.dependsOn)] : undefined
  if (dependsOn) {
    checkDependencies(state, issueId, dependsOn)
  }
  return {
    ...state,
    issues: state.issues.map((issue) =>
      issue.id === issueId
        ? {
            ...issue,
            ...(patch.title?.trim() ? { title: patch.title.trim() } : {}),
            ...(patch.body !== undefined ? { body: patch.body } : {}),
            ...(patch.criteria
              ? { criteria: patch.criteria.map((c) => c.trim()).filter(Boolean) }
              : {}),
            ...(patch.scope ? { scope: patch.scope } : {}),
            ...(patch.tracker ? { tracker: patch.tracker } : {}),
            ...(dependsOn ? { dependsOn } : {}),
            updatedAt: now
          }
        : issue
    )
  }
}

export function updateWorkflow(
  state: AgentTeamState,
  patch: Partial<AgentTeamWorkflow>
): AgentTeamState {
  const next = { ...state.workflow, ...patch }
  if (
    !Number.isInteger(next.roundsPerIssue) ||
    next.roundsPerIssue < 1 ||
    next.roundsPerIssue > 10
  ) {
    throw new AgentTeamMutationError('Rounds per issue must be between 1 and 10.')
  }
  if (!Number.isInteger(next.batchThreshold) || next.batchThreshold < 0) {
    throw new AgentTeamMutationError('The batch threshold must be 0 or more.')
  }
  return { ...state, workflow: next }
}
