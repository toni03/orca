import { describe, expect, it } from 'vitest'
import { createInitialAgentTeamState } from './agent-team-builtin-templates'
import { planAgentTeamAssignments } from './agent-team-scheduler'
import type { AgentTeam, AgentTeamIssue, AgentTeamState } from './agent-team-types'

const dev: AgentTeam = {
  id: 'dev',
  name: 'Development',
  createdAt: 0,
  steps: [
    { id: 'build', name: 'Develop', roleId: 'builtin:developer', seatIds: ['d1', 'd2'] },
    { id: 'qa', name: 'QA', roleId: 'builtin:qa', seatIds: ['qa'] }
  ]
}

const release: AgentTeam = {
  id: 'rel',
  name: 'Release',
  createdAt: 0,
  steps: [{ id: 'ship', name: 'Ship', roleId: 'builtin:developer', seatIds: ['r1'] }]
}

function issue(id: string, patch: Partial<AgentTeamIssue> = {}): AgentTeamIssue {
  return {
    id,
    repoId: 'repo-a',
    teamId: 'dev',
    title: `Issue ${id}`,
    body: '',
    criteria: [],
    status: 'queued',
    priority: 0,
    scope: 'shared',
    dependsOn: [],
    stepIndex: 0,
    round: 1,
    assignments: [],
    createdAt: 0,
    updatedAt: 0,
    ...patch
  }
}

function started(id: string, seatId: string, patch: Partial<AgentTeamIssue> = {}): AgentTeamIssue {
  return issue(id, {
    status: 'working',
    assignments: [
      { id: `${id}-a1`, seatId, stepId: 'build', round: 1, roleVersion: 1, startedAt: 0 }
    ],
    ...patch
  })
}

/** Waiting for the user after its first step finished: holds the project, no open session. */
function needsYou(id: string, patch: Partial<AgentTeamIssue> = {}): AgentTeamIssue {
  return issue(id, {
    status: 'needs-you',
    stepIndex: 1,
    assignments: [
      {
        id: `${id}-a1`,
        seatId: 'd1',
        stepId: 'build',
        round: 1,
        roleVersion: 1,
        startedAt: 0,
        endedAt: 1
      }
    ],
    ...patch
  })
}

function state(issues: AgentTeamIssue[]): AgentTeamState {
  const initial = createInitialAgentTeamState(0)
  const seat = (id: string) => ({
    id,
    name: id,
    agent: 'claude' as const,
    instructions: '',
    createdAt: 0
  })
  return {
    ...initial,
    teams: [dev, release],
    seats: ['d1', 'd2', 'qa', 'r1'].map(seat),
    issues
  }
}

function startedIds(issues: AgentTeamIssue[]): string[] {
  return planAgentTeamAssignments(state(issues)).assignments.map((a) => a.issueId)
}

describe('agent team scheduler', () => {
  it('gives each free seat the highest-priority runnable issue', () => {
    const plan = planAgentTeamAssignments(
      state([
        issue('low', { priority: 2 }),
        issue('high', { priority: 1 }),
        issue('mid', { priority: 1.5 })
      ])
    )
    expect(plan.assignments.map((a) => [a.issueId, a.seatId])).toEqual([
      ['high', 'd1'],
      ['mid', 'd2']
    ])
    expect(plan.waiting.low).toEqual({ kind: 'no-free-seat', stepId: 'build' })
  })

  it('skips paused seats and waits when every seat of the step is paused', () => {
    const pausedOne = state([issue('a'), issue('b', { priority: 2 })])
    const onlyD2 = planAgentTeamAssignments({
      ...pausedOne,
      seats: pausedOne.seats.map((s) => (s.id === 'd1' ? { ...s, paused: true } : s))
    })
    expect(onlyD2.assignments.map((a) => [a.issueId, a.seatId])).toEqual([['a', 'd2']])
    const allPaused = planAgentTeamAssignments({
      ...pausedOne,
      seats: pausedOne.seats.map((s) => ({ ...s, paused: true }))
    })
    expect(allPaused.waiting.a).toEqual({ kind: 'seats-paused', stepId: 'build' })
    const atLimit = planAgentTeamAssignments({
      ...pausedOne,
      limitPauses: [{ agent: 'claude', startedAt: 0 }]
    })
    expect(atLimit.waiting.a).toEqual({ kind: 'plan-limit', stepId: 'build' })
  })

  it('keeps an exclusive issue out of a project another issue is working in', () => {
    const plan = planAgentTeamAssignments(
      state([started('busy', 'd1'), issue('refactor', { scope: 'exclusive' })])
    )
    expect(plan.assignments).toEqual([])
    expect(plan.waiting.refactor).toEqual({
      kind: 'project-locked',
      byIssueId: 'busy',
      byTeamId: 'dev',
      scope: 'project'
    })
  })

  it('lets shared issues in other projects run beside an exclusive one', () => {
    expect(
      startedIds([
        started('refactor', 'd1', { scope: 'exclusive' }),
        issue('same-project'),
        issue('other', { repoId: 'repo-b' })
      ])
    ).toEqual(['other'])
  })

  it('keeps the queue of another team moving while an issue of the project waits for the user', () => {
    expect(startedIds([needsYou('waiting'), issue('ship', { teamId: 'rel' })])).toEqual(['ship'])
  })

  it('lets a needs-you issue hold only as much as one in progress', () => {
    const shared = state([needsYou('waiting'), issue('next')])
    expect(planAgentTeamAssignments(shared).assignments.map((a) => a.issueId)).toEqual(['next'])
    const teamLock = planAgentTeamAssignments(
      state([needsYou('waiting', { scope: 'exclusive-team' }), issue('next')])
    )
    expect(teamLock.waiting.next).toEqual({
      kind: 'project-locked',
      byIssueId: 'waiting',
      byTeamId: 'dev',
      scope: 'team'
    })
  })

  it('holds only its own team for a team-exclusive issue', () => {
    const plan = planAgentTeamAssignments(
      state([
        started('migration', 'd1', { scope: 'exclusive-team' }),
        issue('dev-next'),
        issue('ship', { teamId: 'rel' })
      ])
    )
    expect(plan.assignments.map((a) => a.issueId)).toEqual(['ship'])
    expect(plan.waiting['dev-next']).toEqual({
      kind: 'project-locked',
      byIssueId: 'migration',
      byTeamId: 'dev',
      scope: 'team'
    })
  })

  it('holds every team of the project for an exclusive issue', () => {
    const plan = planAgentTeamAssignments(
      state([needsYou('upgrade', { scope: 'exclusive' }), issue('ship', { teamId: 'rel' })])
    )
    expect(plan.assignments).toEqual([])
    expect(plan.waiting.ship).toEqual({
      kind: 'project-locked',
      byIssueId: 'upgrade',
      byTeamId: 'dev',
      scope: 'project'
    })
  })

  it('waits for a dependency owned by another team', () => {
    const plan = planAgentTeamAssignments(
      state([needsYou('api'), issue('ship', { teamId: 'rel', dependsOn: ['api'] })])
    )
    expect(plan.waiting.ship).toEqual({ kind: 'dependency', issueId: 'api' })
  })

  it('waits for unfinished dependencies', () => {
    const plan = planAgentTeamAssignments(
      state([issue('a', { status: 'registered' }), issue('b', { dependsOn: ['a'] })])
    )
    expect(plan.waiting.b).toEqual({ kind: 'dependency', issueId: 'a' })
  })

  it('starts nothing new for a paused team', () => {
    const paused = { ...state([issue('a')]), teams: [{ ...dev, paused: true }, release] }
    const plan = planAgentTeamAssignments(paused)
    expect(plan.assignments).toEqual([])
    expect(plan.waiting.a).toEqual({ kind: 'team-paused' })
  })

  it('returns a reworked issue to the developer who built it', () => {
    const reworked = issue('i1', {
      status: 'working',
      round: 2,
      assignments: [
        {
          id: 'x',
          seatId: 'd2',
          stepId: 'build',
          round: 1,
          roleVersion: 1,
          startedAt: 0,
          endedAt: 1
        }
      ]
    })
    expect(planAgentTeamAssignments(state([reworked])).assignments[0].seatId).toBe('d2')
  })
})
