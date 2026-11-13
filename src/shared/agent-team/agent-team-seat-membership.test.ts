import { describe, expect, it } from 'vitest'
import { createInitialAgentTeamState } from './agent-team-builtin-templates'
import { applyAgentTeamStateCommand, type AgentTeamStateCommand } from './agent-team-commands'
import { withConsistentSeats } from './agent-team-seat-membership'
import type { AgentTeamState } from './agent-team-types'

function run(commands: AgentTeamStateCommand[]): AgentTeamState {
  let next = 0
  const ids = { newId: () => `id-${++next}`, now: 1000 }
  return commands.reduce(
    (state, command) => applyAgentTeamStateCommand(state, command, ids),
    createInitialAgentTeamState(1000)
  )
}

// Template steps get id-2 (Develop), id-3 (QA) and id-4 (Senior review); team is id-1.
const TEAM_WITH_SEATS: AgentTeamStateCommand[] = [
  { kind: 'team.create', name: 'Development', templateId: 'builtin:development' },
  { kind: 'seat.add', teamId: 'id-1', stepId: 'id-2', name: 'Dev 1', agent: 'claude' },
  { kind: 'seat.add', teamId: 'id-1', stepId: 'id-3', name: 'QA 1', agent: 'codex' }
]

describe('agent team seat membership', () => {
  it('removing a step retires only its seats', () => {
    const state = run([...TEAM_WITH_SEATS, { kind: 'step.remove', teamId: 'id-1', stepId: 'id-3' }])
    expect(state.seats.map((seat) => [seat.name, seat.retiredAt])).toEqual([
      ['Dev 1', undefined],
      ['QA 1', 1000]
    ])
  })

  it('retiring a seat takes it out of its step', () => {
    const state = run([...TEAM_WITH_SEATS, { kind: 'seat.retire', seatId: 'id-5' }])
    expect(state.teams[0].steps.map((step) => step.seatIds)).toEqual([[], ['id-6'], []])
  })

  it('cleans files with orphan seats and retired seats still in steps', () => {
    const saved = run(TEAM_WITH_SEATS)
    const legacy: AgentTeamState = {
      ...saved,
      seats: [
        ...saved.seats.map((seat) => (seat.name === 'QA 1' ? { ...seat, retiredAt: 500 } : seat)),
        { id: 'orphan', name: 'Auditor', agent: 'claude', instructions: '', createdAt: 900 }
      ]
    }
    const clean = withConsistentSeats(legacy, 2000)
    expect(clean.teams[0].steps.map((step) => step.seatIds)).toEqual([['id-5'], [], []])
    expect(clean.seats.map((seat) => [seat.name, seat.retiredAt])).toEqual([
      ['Dev 1', undefined],
      ['QA 1', 500],
      ['Auditor', 2000]
    ])
    expect(withConsistentSeats(clean, 3000)).toBe(clean)
  })
})
