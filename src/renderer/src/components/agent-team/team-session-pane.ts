import { useAppStore } from '@/store'
import { revealTerminalPane } from '@/lib/reveal-terminal-pane'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'

/** The live hook status of a seat session, matched by its runtime terminal handle. */
export function useSessionStatus(terminalHandle: string | undefined): AgentStatusEntry | undefined {
  return useAppStore((s) =>
    terminalHandle
      ? Object.values(s.agentStatusByPaneKey).find(
          (entry) => entry.terminalHandle === terminalHandle
        )
      : undefined
  )
}

/** What the session is doing now, for example `Edit · src/auth.ts` or `Bash · pnpm test`. */
export function sessionActivityLine(status: AgentStatusEntry | undefined): string | null {
  if (!status?.toolName) {
    return null
  }
  const input = status.toolInput?.replace(/\s+/g, ' ').trim()
  return input ? `${status.toolName} · ${input}` : status.toolName
}

/** Focuses the session's own pane when its status names it; otherwise opens its worktree. */
export function revealSession(status: AgentStatusEntry | undefined, worktreeId: string): void {
  const separator = status?.paneKey.indexOf(':') ?? -1
  if (status && separator > 0) {
    const revealed = revealTerminalPane({
      worktreeId: status.worktreeId ?? worktreeId,
      tabId: status.paneKey.slice(0, separator),
      leafId: status.paneKey.slice(separator + 1),
      executionHostId: null
    })
    if (revealed) {
      return
    }
  }
  activateAndRevealWorktree(worktreeId)
}
