import { describe, expect, it, vi } from 'vitest'
import { createInitialAgentTeamState } from '../../shared/agent-team/agent-team-builtin-templates'
import type { AgentTeamState } from '../../shared/agent-team/agent-team-types'
import type { ClaudeUsageStore } from '../claude-usage/store'
import type { Store } from '../persistence/loading-store/store'
import type { AgentTeamStore } from './agent-team-store'
import { startAgentTeamUsageCollector } from './agent-team-usage-collector'

const NOW = 10 * 60_000

function stateWith(endedAt: number): AgentTeamState {
  return {
    ...createInitialAgentTeamState(0),
    seats: [{ id: 'seat', name: 'Dev', agent: 'claude', instructions: '', createdAt: 0 }],
    issues: [
      {
        id: 'issue',
        repoId: 'repo',
        teamId: 'team',
        title: 'Issue',
        body: '',
        criteria: [],
        status: 'working',
        priority: 0,
        scope: 'shared',
        dependsOn: [],
        stepIndex: 1,
        round: 1,
        worktreeId: 'wt',
        assignments: [
          {
            id: 'a1',
            seatId: 'seat',
            stepId: 'build',
            round: 1,
            roleVersion: 1,
            terminalHandle: 'term',
            startedAt: 0,
            endedAt
          }
        ],
        createdAt: 0,
        updatedAt: 0
      }
    ]
  }
}

function setup(endedAt: number) {
  let state = stateWith(endedAt)
  const store = {
    get: () => state,
    update: (mutate: (current: AgentTeamState) => AgentTeamState) => (state = mutate(state))
  }
  const getAutomationRunUsage = vi.fn(async () => ({
    status: 'known' as const,
    inputTokens: 100,
    outputTokens: 20,
    cacheReadTokens: 400,
    totalTokens: 520,
    unavailableMessage: null
  }))
  const stop = startAgentTeamUsageCollector(
    // SAFETY: the collector only calls get/update on the store and getRepo on repos.
    store as unknown as AgentTeamStore,
    // SAFETY: a local repo has no connection id.
    { getRepo: () => ({ id: 'repo', connectionId: null }) } as unknown as Store,
    {
      // SAFETY: the collector only calls getAutomationRunUsage.
      claude: () => ({ getAutomationRunUsage }) as unknown as ClaudeUsageStore,
      codex: () => null
    },
    () => NOW
  )
  return { stop, getAutomationRunUsage, usage: () => state.issues[0].assignments[0].usage }
}

describe('agent team usage collector', () => {
  it('records the tokens of a session once its transcript has settled', async () => {
    const { stop, getAutomationRunUsage, usage } = setup(NOW - 120_000)
    await vi.waitFor(() => expect(usage()).toBeDefined())
    stop()
    expect(getAutomationRunUsage).toHaveBeenCalledWith({
      worktreeId: 'wt',
      startedAt: 0,
      completedAt: NOW - 120_000,
      terminalSessionId: null
    })
    expect(usage()).toEqual({
      status: 'known',
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 400,
      totalTokens: 520
    })
  })

  it('waits while the session has only just ended', () => {
    const { stop, getAutomationRunUsage, usage } = setup(NOW - 1_000)
    stop()
    expect(getAutomationRunUsage).not.toHaveBeenCalled()
    expect(usage()).toBeUndefined()
  })
})
