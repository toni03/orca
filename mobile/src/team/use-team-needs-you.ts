import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import type { RpcClient } from '../transport/rpc/rpc-client-contract'
import { subscribeConnectionRevival } from '../diagnostics/connection/connection-revival-signal'
import { translate } from '../i18n/mobile-i18n'
import {
  teamIssueDecideWrite,
  teamNeedsYouRead,
  type TeamNeedsYouDecision,
  type TeamNeedsYouList
} from './team-needs-you-operations'

// The desktop publishes no team event to phones yet, so the visible list polls.
const POLL_MS = 10_000

function errorMessage(failure: unknown): string {
  const message = failure instanceof Error ? failure.message : ''
  if (/forbidden|method_not_found|not available to mobile clients/.test(message)) {
    return translate(
      'team.mobile.hostUnavailable',
      'The agent team is unavailable on this host. Update Orca on that host and reconnect.'
    )
  }
  if (/disconnect|connection|cutover|closed|timeout/i.test(message)) {
    return translate(
      'team.mobile.hostUnreachable',
      'Could not reach this host. Reconnect, then refresh.'
    )
  }
  return message || translate('team.mobile.actionFailed', 'Could not complete this action.')
}

/** Issues waiting for the user on one host, refreshed while the screen is visible. */
export function useTeamNeedsYou(client: RpcClient | null) {
  const [list, setList] = useState<TeamNeedsYouList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const mounted = useRef(false)
  const readId = useRef(0)

  const refresh = useCallback(async () => {
    if (!client || client.getState() !== 'connected') {
      return
    }
    const id = ++readId.current
    try {
      const reply = await teamNeedsYouRead.request(client, { status: 'needs-you' })
      const next = teamNeedsYouRead.interpret(reply)
      if (mounted.current && id === readId.current) {
        setList(next)
        setError(null)
      }
    } catch (failure) {
      if (mounted.current && id === readId.current) {
        setError(errorMessage(failure))
      }
    }
  }, [client])

  useEffect(() => {
    mounted.current = true
    const stopState = client?.onStateChange(() => void refresh())
    const stopRevival = subscribeConnectionRevival(() => void refresh())
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh()
      }
    })
    const poll = setInterval(() => {
      if (AppState.currentState === 'active') {
        void refresh()
      }
    }, POLL_MS)
    void refresh()
    return () => {
      mounted.current = false
      stopState?.()
      stopRevival()
      appState.remove()
      clearInterval(poll)
    }
  }, [client, refresh])

  const decide = useCallback(
    async (issueId: string, decision: TeamNeedsYouDecision): Promise<boolean> => {
      if (!client || client.getState() !== 'connected' || busyId) {
        return false
      }
      setBusyId(issueId)
      try {
        teamIssueDecideWrite.interpret(
          await teamIssueDecideWrite.request(client, { issueId, decision })
        )
        return true
      } catch (failure) {
        if (mounted.current) {
          setError(errorMessage(failure))
        }
        return false
      } finally {
        if (mounted.current) {
          setBusyId(null)
          void refresh()
        }
      }
    },
    [client, busyId, refresh]
  )

  return { list, error, busyId, refresh, decide }
}
