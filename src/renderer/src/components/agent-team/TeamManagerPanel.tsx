import { useEffect, useState } from 'react'
import { SquareTerminal, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import NativeChatView from '../native-chat/NativeChatView'
import type { AgentTeamManagerSession } from '../../../../shared/agent-team/agent-team-ipc'
import { TeamManagerStartForm } from './TeamManagerStartForm'
import { TeamIconButton } from './TeamIconButton'

// Picks up a Manager that exits or one started from its workspace without a push signal.
const SESSION_POLL_MS = 15_000

function useManagerSession(): {
  session: AgentTeamManagerSession | null
  loading: boolean
  setSession: (session: AgentTeamManagerSession) => void
} {
  const [session, setSession] = useState<AgentTeamManagerSession | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    const read = (): void => {
      void window.api.agentTeam
        .managerSession()
        .then((next) => {
          if (!cancelled) {
            setSession(next)
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
          }
        })
    }
    read()
    const timer = setInterval(read, SESSION_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])
  return { session, loading, setSession }
}

/** The Manager conversation docked beside the board, drawn as Orca's native chat over its terminal. */
export function TeamManagerPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { session, loading, setSession } = useManagerSession()
  const [focused, setFocused] = useState(false)
  const chatReady = session?.tabId && session.paneKey

  return (
    <aside
      className="flex min-h-0 w-[420px] shrink-0 flex-col border-l border-border"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false)
        }
      }}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <h2 className="mr-auto text-sm font-semibold">
          {translate('auto.components.agentTeam.TeamManagerPanel.title', 'Manager')}
        </h2>
        {session ? (
          <TeamIconButton
            variant="ghost"
            size="icon-sm"
            label={translate(
              'auto.components.agentTeam.TeamManagerPanel.openTerminal',
              'Open the Manager terminal'
            )}
            onClick={() => activateAndRevealWorktree(session.worktreeId)}
          >
            <SquareTerminal />
          </TeamIconButton>
        ) : null}
        <TeamIconButton
          variant="ghost"
          size="icon-sm"
          label={translate('auto.components.agentTeam.TeamManagerPanel.close', 'Hide Manager')}
          onClick={onClose}
        >
          <X />
        </TeamIconButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {loading ? null : session && chatReady ? (
          <NativeChatView
            key={session.paneKey}
            terminalTabId={session.tabId ?? ''}
            paneKey={session.paneKey ?? undefined}
            targetPtyId={session.ptyId}
            launchAgent={session.agent}
            isVisible
            isFocusedGroup={focused}
            ownsTabWideLaunchDraft={false}
            onSwitchToTerminal={() => activateAndRevealWorktree(session.worktreeId)}
          />
        ) : (
          <div className="overflow-auto scrollbar-sleek">
            <TeamManagerStartForm onStarted={setSession} />
          </div>
        )}
      </div>
    </aside>
  )
}
