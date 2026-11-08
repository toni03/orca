import type {
  AgentTeamIssue,
  AgentTeamNeedsYouReason,
  AgentTeamState
} from '../../shared/agent-team/agent-team-types'
import { translateMain } from '../i18n/main-i18n'
import type { MobileNotificationDispatchEvent } from '../runtime/runtime-mobile-notification-controller'

function reasonText(reason: AgentTeamNeedsYouReason): string {
  switch (reason) {
    case 'ready':
      return translateMain('agentTeam.mobileAlert.ready', 'Ready to merge')
    case 'escalated':
      return translateMain('agentTeam.mobileAlert.escalated', 'Escalated')
    case 'blocked':
      return translateMain('agentTeam.mobileAlert.blocked', 'A seat is blocked')
    case 'question':
      return translateMain('agentTeam.mobileAlert.question', 'A question for you')
    case 'failed':
      return translateMain('agentTeam.mobileAlert.failed', 'A session stopped')
  }
}

const waitingKey = (issue: AgentTeamIssue): string | null =>
  issue.status === 'needs-you' && issue.needsYou ? `${issue.id}:${issue.needsYou.at}` : null

/**
 * Tells paired phones when an issue starts waiting for the user. The desktop shows no OS
 * notification for it (the sidebar badge covers that), so this only reaches Orca Mobile.
 */
export function startAgentTeamMobileAlerts(args: {
  getState: () => AgentTeamState
  subscribe: (listener: (state: AgentTeamState) => void) => () => void
  projectName: (repoId: string) => string
  dispatch: (event: MobileNotificationDispatchEvent) => void
  now?: () => number
}): () => void {
  const now = args.now ?? Date.now
  // Items already waiting at startup are not news.
  const seen = new Set(
    args
      .getState()
      .issues.map(waitingKey)
      .filter((key) => key !== null)
  )
  return args.subscribe((state) => {
    for (const issue of state.issues) {
      const key = waitingKey(issue)
      if (!key || seen.has(key) || !issue.needsYou) {
        continue
      }
      seen.add(key)
      const project = args.projectName(issue.repoId)
      args.dispatch({
        type: 'notification',
        emittedAt: now(),
        // Phones only know agent alerts; 'blocked' makes it count as needing input.
        source: 'agent-task-complete',
        agentState: 'blocked',
        title: `${project} ${issue.tracker?.key ?? issue.id.slice(0, 6)} · ${reasonText(issue.needsYou.reason)}`,
        body: issue.title,
        attentionKey: `agent-team:${key}`,
        notificationId: `agent-team:${key}`,
        ...(issue.worktreeId ? { worktreeId: issue.worktreeId } : {})
      })
    }
  })
}
