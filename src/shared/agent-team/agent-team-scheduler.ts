import { openAssignment } from './agent-team-pipeline'
import { agentsOnLimitPause } from './agent-team-plan-limits'
import type { AgentTeamIssue, AgentTeamSeat, AgentTeamState } from './agent-team-types'

export type AgentTeamPlannedAssignment = {
  issueId: string
  seatId: string
  stepId: string
}

export type AgentTeamWaitReason =
  | { kind: 'paused' }
  | { kind: 'team-paused' }
  | { kind: 'dependency'; issueId: string }
  | { kind: 'project-locked'; byIssueId: string }
  | { kind: 'no-free-seat'; stepId: string }
  | { kind: 'seats-paused'; stepId: string }
  | { kind: 'plan-limit'; stepId: string }
  | { kind: 'no-seat'; stepId: string }
  | { kind: 'missing-team' }

export type AgentTeamSchedule = {
  assignments: AgentTeamPlannedAssignment[]
  waiting: Record<string, AgentTeamWaitReason>
}

/** Started issues hold their project until they finish, even while waiting for the user. */
function holdsProject(issue: AgentTeamIssue): boolean {
  return (
    (issue.status === 'working' || issue.status === 'needs-you') && issue.assignments.length > 0
  )
}

function byPriority(a: AgentTeamIssue, b: AgentTeamIssue): number {
  return a.priority - b.priority || a.createdAt - b.createdAt
}

function projectLock(
  issue: AgentTeamIssue,
  active: readonly AgentTeamIssue[]
): AgentTeamIssue | undefined {
  if (holdsProject(issue)) {
    return undefined
  }
  const sameProject = active.filter(
    (other) => other.repoId === issue.repoId && other.id !== issue.id
  )
  if (issue.scope === 'exclusive') {
    return sameProject[0]
  }
  return sameProject.find((other) => other.scope === 'exclusive')
}

function preferredSeat(issue: AgentTeamIssue, stepId: string, free: readonly AgentTeamSeat[]) {
  for (let index = issue.assignments.length - 1; index >= 0; index -= 1) {
    const previous = issue.assignments[index]
    if (previous.stepId === stepId) {
      const same = free.find((seat) => seat.id === previous.seatId)
      if (same) {
        return same
      }
      break
    }
  }
  return free[0]
}

/** Which free seat takes which issue next, plus why every other runnable issue waits. */
export function planAgentTeamAssignments(
  state: AgentTeamState,
  /** Agent CLIs out of plan: their seats take nothing new until the window resets. */
  limitedAgents: ReadonlySet<string> = agentsOnLimitPause(state)
): AgentTeamSchedule {
  const waiting: Record<string, AgentTeamWaitReason> = {}
  const runnable = state.issues
    .filter(
      (issue) => (issue.status === 'queued' || issue.status === 'working') && !openAssignment(issue)
    )
    .sort(byPriority)
  if (state.workflow.paused) {
    for (const issue of runnable) {
      waiting[issue.id] = { kind: 'paused' }
    }
    return { assignments: [], waiting }
  }

  const busySeatIds = new Set(
    state.issues.flatMap((issue) => {
      const open = openAssignment(issue)
      return open ? [open.seatId] : []
    })
  )
  const active = state.issues.filter(holdsProject)
  const issuesById = new Map(state.issues.map((issue) => [issue.id, issue]))
  const assignments: AgentTeamPlannedAssignment[] = []

  for (const issue of runnable) {
    const team = state.teams.find((candidate) => candidate.id === issue.teamId)
    const step = team?.steps[issue.stepIndex]
    if (!team || !step) {
      waiting[issue.id] = { kind: 'missing-team' }
      continue
    }
    if (team.paused) {
      waiting[issue.id] = { kind: 'team-paused' }
      continue
    }
    const blockingDependency = issue.dependsOn.find((id) => issuesById.get(id)?.status !== 'done')
    if (blockingDependency) {
      waiting[issue.id] = { kind: 'dependency', issueId: blockingDependency }
      continue
    }
    const lockedBy = projectLock(issue, active)
    if (lockedBy) {
      waiting[issue.id] = { kind: 'project-locked', byIssueId: lockedBy.id }
      continue
    }
    const stepSeats = state.seats.filter(
      (seat) => step.seatIds.includes(seat.id) && seat.retiredAt === undefined
    )
    if (stepSeats.length === 0) {
      waiting[issue.id] = { kind: 'no-seat', stepId: step.id }
      continue
    }
    const unpaused = stepSeats.filter((candidate) => candidate.paused !== true)
    if (unpaused.length === 0) {
      waiting[issue.id] = { kind: 'seats-paused', stepId: step.id }
      continue
    }
    const activeSeats = unpaused.filter((candidate) => !limitedAgents.has(candidate.agent))
    if (activeSeats.length === 0) {
      waiting[issue.id] = { kind: 'plan-limit', stepId: step.id }
      continue
    }
    const seat = preferredSeat(
      issue,
      step.id,
      activeSeats.filter((candidate) => !busySeatIds.has(candidate.id))
    )
    if (!seat) {
      waiting[issue.id] = { kind: 'no-free-seat', stepId: step.id }
      continue
    }
    busySeatIds.add(seat.id)
    if (!holdsProject(issue)) {
      active.push(issue)
    }
    assignments.push({ issueId: issue.id, seatId: seat.id, stepId: step.id })
  }
  return { assignments, waiting }
}
