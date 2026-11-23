// A Needs you issue as its Manager bot's item: the question with quick replies, and the reply read back
// as the team decision it means.
import {
  BOT_ITEM_ASK_LIMITS,
  botItemPickedReplies,
  botItemQuestionShape,
  type BotItemAsk
} from '../bots/bot-item-ask'
import { BOT_ITEM_LIMITS } from '../bots/bot-items'
import type { AgentTeamUserDecision } from './agent-team-pipeline'
import type { AgentTeamIssue, AgentTeamNeedsYouReason } from './agent-team-types'

/** Titles of team items start with this, so the Manager bot leaves them to Orca. */
export const AGENT_TEAM_ITEM_PREFIX = 'Team ·'

const MARK_DONE = 'Mark done'
const RETRY = 'Retry'

const PROMPTS: Record<AgentTeamNeedsYouReason, string> = {
  ready: 'Every step passed. Mark it done, or reply with what to change to send it back to Build.',
  escalated:
    'A Check step escalated it. Mark it done, or reply with what to change to send it back to Build.',
  blocked: 'The seat is blocked. Pick an answer or reply with your own.',
  question: 'The seat asks a question. Pick an answer or reply with your own.',
  failed: 'The step failed. Retry it, or reply with what the seat should do differently.'
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function needsYouItemTitle(issue: Pick<AgentTeamIssue, 'title' | 'tracker'>): string {
  const key = issue.tracker?.key ? `${issue.tracker.key} ` : ''
  return clip(`${AGENT_TEAM_ITEM_PREFIX} ${key}${issue.title}`, BOT_ITEM_LIMITS.title)
}

function quickReplies(issue: AgentTeamIssue): string[] {
  const reason = issue.needsYou?.reason
  if (reason === 'ready' || reason === 'escalated') {
    return [MARK_DONE]
  }
  if (reason === 'failed') {
    return [RETRY]
  }
  return (issue.needsYou?.options ?? [])
    .map((option) => option.trim())
    .filter((option, index, all) => option.length > 0 && all.indexOf(option) === index)
    .slice(0, BOT_ITEM_ASK_LIMITS.options)
}

/** The item's question for this Needs you; null when the issue does not wait for the user. */
export function needsYouAsk(issue: AgentTeamIssue, stepName: string | null): BotItemAsk | null {
  const needsYou = issue.needsYou
  if (issue.status !== 'needs-you' || !needsYou) {
    return null
  }
  const where = stepName ? `Step: ${stepName} (round ${issue.round}).` : `Round ${issue.round}.`
  const context = clip(
    [where, needsYou.detail.trim()].filter(Boolean).join('\n\n'),
    BOT_ITEM_LIMITS.text
  )
  const options = quickReplies(issue).map((label) => ({
    label: clip(label, BOT_ITEM_ASK_LIMITS.label)
  }))
  return {
    context,
    questions: [
      { prompt: PROMPTS[needsYou.reason], options, ...(options.length ? { recommended: 0 } : {}) }
    ]
  }
}

/** What the owner's reply on the item decides, or null when it says nothing the team can act on. */
export function needsYouReplyDecision(
  issue: AgentTeamIssue,
  ask: BotItemAsk,
  reply: Record<string, unknown>
): AgentTeamUserDecision | null {
  const reason = issue.needsYou?.reason
  if (issue.status !== 'needs-you' || !reason) {
    return null
  }
  const shape = botItemQuestionShape({ ask })
  const picked = botItemPickedReplies(shape, reply)[0]?.[0]?.label
  if (picked === MARK_DONE) {
    return { kind: 'done' }
  }
  if (picked === RETRY) {
    return { kind: 'resume' }
  }
  const text = (picked ?? (typeof reply.text === 'string' ? reply.text : '')).trim()
  if (!text) {
    return null
  }
  return reason === 'ready' || reason === 'escalated'
    ? { kind: 'request-changes', note: text }
    : { kind: 'answer', note: text }
}
