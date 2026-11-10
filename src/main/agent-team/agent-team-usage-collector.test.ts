import { describe, expect, it, vi } from 'vitest'
import { createInitialAgentTeamState } from '../../shared/agent-team/agent-team-builtin-templates'
import type { AgentTeamState } from '../../shared/agent-team/agent-team-types'
import type { AutomationRunUsage } from '../../shared/automations/history/automation-run'
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
  const known: AutomationRunUsage = {
    status: 'known',
    provider: 'claude',
    model: null,
    inputTokens: 100,
    outputTokens: 20,
    cacheReadTokens: 400,
    cacheWriteTokens: 0,
    reasoningOutputTokens: null,
    totalTokens: 520,
    estimatedCostUsd: null,
    estimatedCostSource: null,
    providerSessionId: null,
    attribution: null,
    collectedAt: NOW,
    unavailableReason: null,
    unavailableMessage: null
  }
  const getAutomationRunUsage = vi.fn(async () => known)
  const stop = startAgentTeamUsageCollector(
    store,
    () => false,
    {
      claude: () => ({
        getAutomationRunUsage,
        getRepoActivity: async () => ({ tokens: 0, activeMs: 0 })
      }),
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
