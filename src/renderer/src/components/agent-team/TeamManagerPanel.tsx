import { useEffect, useRef, useState } from 'react'
import { SquareTerminal, X } from 'lucide-react'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { agentsAtPlanLimit } from '../../../../shared/agent-team/agent-team-plan-limits'
import { getAgentLabel } from '@/lib/agent-catalog'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import NativeChatView from '../native-chat/NativeChatView'
import type { AgentTeamManagerSession } from '../../../../shared/agent-team/agent-team-ipc'
import { TeamManagerStartForm } from './TeamManagerStartForm'
import { TeamIconButton } from './TeamIconButton'
import { TeamManagerMentions } from './TeamManagerMentions'
import { useAgentTeamState } from './use-agent-team-state'

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
  const { state } = useAgentTeamState()
  const chatRoot = useRef<HTMLDivElement>(null)
  const rateLimits = useAppStore((s) => s.rateLimits)
  const limit = session ? agentsAtPlanLimit([session.agent], rateLimits) : null
  const atLimit = session && limit?.has(session.agent)
  const resetsAt = session ? limit?.get(session.agent) : null

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
        <div className="mr-auto flex flex-col">
          <h2 className="text-sm font-semibold">
            {translate('auto.components.agentTeam.TeamManagerPanel.title', 'Manager')}
          </h2>
          <span className="text-2xs text-muted-foreground">
            {session
              ? translate(
                  'auto.components.agentTeam.TeamManagerPanel.scope',
                  'All projects · {{agent}}',
                  { agent: getAgentLabel(session.agent) }
                )
              : translate(
                  'auto.components.agentTeam.TeamManagerPanel.noSession',
                  'All projects · not started'
                )}
          </span>
        </div>
        {state && chatReady ? <TeamManagerMentions state={state} composerRoot={chatRoot} /> : null}
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
      {atLimit ? (
        <p className="border-b border-agent-question/45 bg-agent-question/10 px-4 py-2 text-xs text-agent-question-text">
          {resetsAt
            ? translate(
                'auto.components.agentTeam.TeamManagerPanel.limitUntil',
                'Plan limit reached · the Manager replies after {{at}}',
                {
                  at: new Date(resetsAt).toLocaleTimeString(getIntlLocale(), {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                }
              )
            : translate(
                'auto.components.agentTeam.TeamManagerPanel.limit',
                'Plan limit reached · the Manager replies when the plan window resets'
              )}
        </p>
      ) : null}
      <div ref={chatRoot} className="flex min-h-0 flex-1 flex-col">
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
