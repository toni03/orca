import { describe, expect, it } from 'vitest'
import { needsYouAsk, needsYouReplyDecision } from './agent-team-needs-you-ask'
import type { AgentTeamIssue } from './agent-team-types'

function waiting(reason: 'ready' | 'question', options?: string[]): AgentTeamIssue {
  return {
    id: 'i1',
    repoId: 'r1',
    teamId: 't1',
    title: 'Fix login',
    body: '',
    criteria: [],
    status: 'needs-you',
    priority: 1,
    scope: 'shared',
    dependsOn: [],
    stepIndex: 2,
    round: 1,
    assignments: [],
    needsYou: { reason, detail: 'Details', at: 10, ...(options ? { options } : {}) },
    createdAt: 1,
    updatedAt: 1
  }
}

describe('agent team Needs you items', () => {
  it('marks a ready issue done from its quick reply', () => {
    const issue = waiting('ready')
    const ask = needsYouAsk(issue, null)!
    expect(needsYouReplyDecision(issue, ask, { text: 'Mark done' })).toEqual({ kind: 'done' })
  })

  it('requests changes on a ready issue from a written reply', () => {
    const issue = waiting('ready')
    const ask = needsYouAsk(issue, 'Review')!
    expect(needsYouReplyDecision(issue, ask, { text: 'Rename the flag' })).toEqual({
      kind: 'request-changes',
      note: 'Rename the flag'
    })
  })

  it("answers a seat's question with the option the owner picked", () => {
    const issue = waiting('question', ['Use v2', 'Keep v1'])
    const ask = needsYouAsk(issue, 'Build')!
    expect(needsYouReplyDecision(issue, ask, { text: 'Keep v1' })).toEqual({
      kind: 'answer',
      note: 'Keep v1'
    })
  })
})
