import { describe, expect, it, vi } from 'vitest'
import { createInitialAgentTeamState } from '../../shared/agent-team/agent-team-builtin-templates'
import type { AgentTeamIssue, AgentTeamState } from '../../shared/agent-team/agent-team-types'
import { startAgentTeamMobileAlerts } from './agent-team-mobile-alerts'

vi.mock('../i18n/main-i18n', () => ({
  translateMain: (_key: string, fallback: string) => fallback
}))

function issue(id: string, patch: Partial<AgentTeamIssue> = {}): AgentTeamIssue {
  return {
    id,
    repoId: 'repo',
    teamId: 'dev',
    title: `Issue ${id}`,
    body: '',
    criteria: [],
    status: 'working',
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

const waiting = (id: string, at: number): AgentTeamIssue =>
  issue(id, {
    status: 'needs-you',
    worktreeId: `wt-${id}`,
    needsYou: { reason: 'question', detail: 'Which API?', at }
  })

describe('agent team mobile alerts', () => {
  it('alerts once per item entering Needs you, not for items already waiting', () => {
    let listener: (state: AgentTeamState) => void = () => {}
    const base = createInitialAgentTeamState(0)
    const dispatch = vi.fn()
    startAgentTeamMobileAlerts({
      getState: () => ({ ...base, issues: [waiting('old', 1)] }),
      subscribe: (next) => {
        listener = next
        return () => {}
      },
      projectName: () => 'api',
      dispatch,
      now: () => 5
    })
    const next = { ...base, issues: [waiting('old', 1), waiting('new', 2)] }
    listener(next)
    listener(next)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      source: 'agent-task-complete',
      agentState: 'blocked',
      title: 'api new · A question for you',
      body: 'Issue new',
      worktreeId: 'wt-new'
    })
  })
})
