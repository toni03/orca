import type {
  AgentTeamAssignment,
  AgentTeamAssignmentUsage,
  AgentTeamIssue,
  AgentTeamState
} from '../../shared/agent-team/agent-team-types'
import type { AutomationRunUsage } from '../../shared/automations-types'
import type { ClaudeUsageStore } from '../claude-usage/store'
import type { CodexUsageStore } from '../codex-usage/store'
import type { AgentTeamStore } from './agent-team-store'

type UsageLookup = Pick<ClaudeUsageStore | CodexUsageStore, 'getAutomationRunUsage'>

export type AgentTeamUsageSources = {
  claude: () => UsageLookup | null
  codex: () => UsageLookup | null
}

// Transcripts flush after the session ends; reading too early misses the last turn.
const SETTLE_MS = 60_000
const SWEEP_MS = 60_000

function fromRunUsage(usage: AutomationRunUsage): AgentTeamAssignmentUsage {
  if (usage.status !== 'known') {
    return { status: 'unavailable', reason: usage.unavailableMessage ?? 'Usage is unavailable.' }
  }
  return {
    status: 'known',
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0
  }
}

async function lookUsage(
  sources: AgentTeamUsageSources,
  agent: string,
  input: { worktreeId: string; startedAt: number; completedAt: number }
): Promise<AgentTeamAssignmentUsage> {
  const lookup = { ...input, terminalSessionId: null }
  const store = agent === 'claude' ? sources.claude() : agent === 'codex' ? sources.codex() : null
  if (agent !== 'claude' && agent !== 'codex') {
    return { status: 'unavailable', reason: 'This agent does not report usage to Orca yet.' }
  }
  if (!store) {
    return { status: 'unavailable', reason: 'Usage tracking is not available.' }
  }
  return fromRunUsage(await store.getAutomationRunUsage(lookup))
}

/** Fills `usage` on finished assignments from the local Claude and Codex usage stores. */
export function startAgentTeamUsageCollector(
  store: Pick<AgentTeamStore, 'get' | 'update'>,
  /** Remote sessions write transcripts on their own host, out of reach here. */
  isRemoteRepo: (repoId: string) => boolean,
  sources: AgentTeamUsageSources,
  now: () => number = Date.now
): () => void {
  const inFlight = new Set<string>()

  const pending = (
    state: AgentTeamState
  ): { issue: AgentTeamIssue; assignment: AgentTeamAssignment }[] =>
    state.issues.flatMap((issue) =>
      issue.assignments
        .filter(
          (assignment) =>
            assignment.endedAt !== undefined &&
            assignment.usage === undefined &&
            assignment.terminalHandle !== undefined &&
            now() - assignment.endedAt >= SETTLE_MS &&
            !inFlight.has(assignment.id)
        )
        .map((assignment) => ({ issue, assignment }))
    )

  const record = (assignmentId: string, usage: AgentTeamAssignmentUsage): void => {
    store.update((current) => ({
      ...current,
      issues: current.issues.map((issue) =>
        issue.assignments.some((assignment) => assignment.id === assignmentId)
          ? {
              ...issue,
              assignments: issue.assignments.map((assignment) =>
                assignment.id === assignmentId ? { ...assignment, usage } : assignment
              )
            }
          : issue
      )
    }))
  }

  const collect = async (issue: AgentTeamIssue, assignment: AgentTeamAssignment): Promise<void> => {
    const seat = store.get().seats.find((candidate) => candidate.id === assignment.seatId)
    let usage: AgentTeamAssignmentUsage
    if (!seat || !issue.worktreeId || assignment.endedAt === undefined) {
      usage = { status: 'unavailable', reason: 'The session has no workspace to attribute.' }
    } else if (isRemoteRepo(issue.repoId)) {
      usage = { status: 'unavailable', reason: 'Remote sessions are counted on their own host.' }
    } else {
      usage = await lookUsage(sources, seat.agent, {
        worktreeId: issue.worktreeId,
        startedAt: assignment.startedAt,
        completedAt: assignment.endedAt
      }).catch((error: unknown) => ({
        status: 'unavailable' as const,
        reason: error instanceof Error ? error.message : String(error)
      }))
    }
    record(assignment.id, usage)
  }

  const sweep = (): void => {
    for (const { issue, assignment } of pending(store.get())) {
      inFlight.add(assignment.id)
      void collect(issue, assignment).finally(() => inFlight.delete(assignment.id))
    }
  }

  const timer = setInterval(sweep, SWEEP_MS)
  timer.unref?.()
  sweep()
  return () => clearInterval(timer)
}
