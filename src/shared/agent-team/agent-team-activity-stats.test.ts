import { describe, expect, it } from 'vitest'
import { createInitialAgentTeamState } from './agent-team-builtin-templates'
import { activeMsInRange, tokensInRange, usageBy } from './agent-team-activity-stats'
import type { AgentTeamAssignment, AgentTeamIssue } from './agent-team-types'

const known = (totalTokens: number) => ({
  status: 'known' as const,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  totalTokens
})

function assignment(patch: Partial<AgentTeamAssignment>): AgentTeamAssignment {
  return {
    id: 'a',
    seatId: 's1',
    stepId: 'build',
    round: 1,
    roleVersion: 1,
    startedAt: 0,
    ...patch
  }
}

describe('agent team activity stats', () => {
  it('counts only the part of a session inside the range, and tokens where it ended', () => {
    const range = { from: 100, to: 200 }
    const spanning = assignment({ startedAt: 50, endedAt: 150, usage: known(10) })
    expect(activeMsInRange(spanning, range, 300)).toBe(50)
    expect(tokensInRange(spanning, range)).toBe(10)
    const running = assignment({ startedAt: 180 })
    expect(activeMsInRange(running, range, 190)).toBe(10)
    expect(tokensInRange(running, range)).toBe(0)
  })

  it('groups usage by project', () => {
    const issue = (
      id: string,
      repoId: string,
      assignments: AgentTeamAssignment[]
    ): AgentTeamIssue => ({
      id,
      repoId,
      teamId: 't',
      title: id,
      body: '',
      criteria: [],
      status: 'working',
      priority: 1,
      scope: 'shared',
      dependsOn: [],
      stepIndex: 0,
      round: 1,
      assignments,
      createdAt: 0,
      updatedAt: 0
    })
    const state = {
      ...createInitialAgentTeamState(0),
      issues: [
        issue('i1', 'r1', [assignment({ startedAt: 0, endedAt: 10, usage: known(5) })]),
        issue('i2', 'r1', [assignment({ id: 'b', startedAt: 0, endedAt: 20, usage: known(7) })])
      ]
    }
    expect(usageBy(state, 'project', { from: 0, to: 100 }, 100).get('r1')).toEqual({
      activeMs: 30,
      tokens: 12
    })
  })
})
