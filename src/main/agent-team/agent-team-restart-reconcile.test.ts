import { describe, expect, it, vi } from 'vitest'
import { createInitialAgentTeamState } from '../../shared/agent-team/agent-team-builtin-templates'
import type { AgentTeamIssue } from '../../shared/agent-team/agent-team-types'
import { reconcileAgentTeamSessionsAfterRestart } from './agent-team-restart-reconcile'

function working(id: string, terminalHandle?: string): AgentTeamIssue {
  return {
    id,
    repoId: 'repo',
    teamId: 'team',
    title: id,
    body: '',
    criteria: [],
    status: 'working',
    priority: 0,
    scope: 'shared',
    dependsOn: [],
    stepIndex: 0,
    round: 1,
    assignments: [
      {
        id: `${id}-a`,
        seatId: 'seat',
        stepId: 'build',
        round: 1,
        roleVersion: 1,
        startedAt: 0,
        ...(terminalHandle ? { terminalHandle } : {})
      }
    ],
    createdAt: 0,
    updatedAt: 0
  }
}

function run(issues: AgentTeamIssue[], live: Map<string, string | null> | null) {
  const stopAssignment = vi.fn()
  const watchExit = vi.fn()
  const state = { ...createInitialAgentTeamState(0), issues }
  const done = reconcileAgentTeamSessionsAfterRestart({
    state: () => state,
    launcher: { liveTerminals: async () => live, watchExit },
    stopAssignment
  })
  return { done, stopAssignment, watchExit }
}

describe('agent team restart reconcile', () => {
  it('re-watches surviving sessions and hands lost ones to the user', async () => {
    const { done, stopAssignment, watchExit } = run(
      [working('alive', 'term-alive'), working('lost', 'term-lost'), working('unstarted')],
      new Map([['term-alive', 'pty-1']])
    )
    await done
    expect(watchExit).toHaveBeenCalledWith('term-alive', expect.any(Function), 'pty-1')
    expect(stopAssignment).toHaveBeenCalledWith('lost-a', 'exited', expect.any(String))
    expect(stopAssignment).toHaveBeenCalledWith('unstarted-a', 'launch-failed', expect.any(String))
    expect(stopAssignment).not.toHaveBeenCalledWith('alive-a', expect.anything(), expect.anything())
  })

  it('leaves sessions alone when liveness cannot be read', async () => {
    const { done, stopAssignment } = run([working('maybe', 'term-maybe')], null)
    await done
    expect(stopAssignment).not.toHaveBeenCalled()
  })
})
