import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { issueKey, needsYouLabel } from './team-labels'

/** In-app notice when an issue starts waiting for the user while they are on another view. */
export function useNeedsYouToasts(state: AgentTeamState | null): void {
  const openTeamPage = useAppStore((s) => s.openTeamPage)
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!state) {
      return
    }
    const waiting = state.issues.filter((issue) => issue.status === 'needs-you' && issue.needsYou)
    const current = new Set(waiting.map((issue) => `${issue.id}:${issue.needsYou?.at ?? 0}`))
    // The first read only records what already waits; old items are not news.
    if (seen.current === null) {
      seen.current = current
      return
    }
    const fresh = waiting.filter(
      (issue) => !seen.current?.has(`${issue.id}:${issue.needsYou?.at ?? 0}`)
    )
    seen.current = current
    const app = useAppStore.getState()
    if (fresh.length === 0 || app.activeView === 'team') {
      return
    }
    const repoName = (repoId: string): string =>
      app.repos.find((repo) => repo.id === repoId)?.displayName ?? repoId
    const first = fresh[0]
    const title =
      fresh.length === 1 && first.needsYou
        ? translate(
            'auto.components.agentTeam.useNeedsYouToasts.one',
            '{{project}} {{key}} · {{reason}}',
            {
              project: repoName(first.repoId),
              key: issueKey(first),
              reason: needsYouLabel(first.needsYou.reason)
            }
          )
        : translate(
            'auto.components.agentTeam.useNeedsYouToasts.many',
            '{{count}} items need you',
            {
              count: fresh.length
            }
          )
    toast(title, {
      ...(fresh.length === 1 ? { description: first.title } : {}),
      action: {
        label: translate('auto.components.agentTeam.useNeedsYouToasts.open', 'Open'),
        onClick: () => openTeamPage('needs-you')
      }
    })
  }, [state, openTeamPage])
}
