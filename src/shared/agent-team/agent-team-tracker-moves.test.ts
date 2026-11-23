import { describe, expect, it } from 'vitest'
import { createInitialAgentTeamState } from './agent-team-builtin-templates'
import { mergeTrackerEvents, trackerMovesBetween } from './agent-team-tracker-moves'
import type { AgentTeamIssue, AgentTeamState } from './agent-team-types'

function stateWith(issues: AgentTeamIssue[]): AgentTeamState {
  const initial = createInitialAgentTeamState(0)
  return {
    ...initial,
    teams: [
      {
        id: 'dev',
        name: 'Development',
        createdAt: 0,
        steps: [
          { id: 'build', name: 'Develop', roleId: 'builtin:developer', seatIds: [] },
          { id: 'qa', name: 'QA', roleId: 'builtin:qa', seatIds: [] }
        ]
      }
    ],
    issues
  }
}

function issue(patch: Partial<AgentTeamIssue>): AgentTeamIssue {
  return {
    id: 'i1',
    repoId: 'repo',
    teamId: 'dev',
    title: 'Login form',
    body: '',
    criteria: [],
    status: 'working',
    priority: 0,
    scope: 'shared',
    dependsOn: [],
    stepIndex: 0,
    round: 1,
    assignments: [],
    tracker: { provider: 'gitlab', key: '#212' },
    createdAt: 0,
    updatedAt: 0,
    ...patch
  }
}

let counter = 0
const nextId = (): string => `e${++counter}`

describe('agent team tracker moves', () => {
  it('reports a tracker-linked issue that reaches a Check step', () => {
    const moves = trackerMovesBetween(
      stateWith([issue({})]),
      stateWith([issue({ stepIndex: 1 })]),
      5,
      nextId
    )
    expect(moves).toHaveLength(1)
    expect(moves[0]).toMatchObject({ issueId: 'i1', key: '#212' })
    expect(moves[0].position).toContain('Check step "QA"')
  })

  it('ignores issues without a tracker key and unchanged positions', () => {
    const untracked = issue({ tracker: undefined })
    expect(
      trackerMovesBetween(
        stateWith([untracked, issue({})]),
        stateWith([{ ...untracked, stepIndex: 1 }, issue({ title: 'Renamed' })]),
        5,
        nextId
      )
    ).toEqual([])
  })

  it('keeps only the latest pending move for each issue', () => {
    const first = {
      id: 'a',
      issueId: 'i1',
      repoId: 'r',
      key: '#1',
      title: 't',
      position: 'Build',
      at: 1
    }
    const later = { ...first, id: 'b', position: 'Check', at: 2 }
    expect(mergeTrackerEvents([first], [later])).toEqual([later])
  })
})
