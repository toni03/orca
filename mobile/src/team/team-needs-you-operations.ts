import * as z from 'zod'
import { bindDeferredRpcOperation, defineRpcOperation } from '../transport/rpc-operation'
import { rpcResultVariant } from '../transport/rpc-operation-result-reader'

const reasonSchema = z.enum(['ready', 'escalated', 'blocked', 'question', 'failed'])

// Only the fields the phone shows; the desktop sends the whole issue.
const issueSchema = z.object({
  id: z.string(),
  repoId: z.string(),
  title: z.string(),
  status: z.string(),
  round: z.number(),
  worktreeId: z.string().optional(),
  tracker: z.object({ key: z.string(), url: z.string().optional() }).optional(),
  needsYou: z
    .object({
      reason: reasonSchema,
      detail: z.string(),
      at: z.number(),
      options: z.array(z.string()).optional()
    })
    .optional(),
  mergeRequest: z.object({ url: z.string() }).optional(),
  assignments: z.array(z.object({ seatId: z.string(), endedAt: z.number().optional() }))
})

const issuesReplySchema = z.object({
  issues: z.array(issueSchema),
  seats: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  projects: z
    .array(z.object({ repoId: z.string(), name: z.string(), color: z.string().nullable() }))
    .default([])
})

export type TeamNeedsYouReason = z.infer<typeof reasonSchema>
export type TeamNeedsYouIssue = z.infer<typeof issueSchema>
export type TeamNeedsYouList = z.infer<typeof issuesReplySchema>

export type TeamNeedsYouDecision =
  | { kind: 'answer'; note: string }
  | { kind: 'request-changes'; note: string }
  | { kind: 'done' }
  | { kind: 'discard' }
  | { kind: 'resume' }

export const teamNeedsYouRead = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'team.mobile-needs-you',
    method: 'team.issues',
    acceptance: 'require-result-or-throw',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('needs-you', issuesReplySchema)
  })
)

export const teamIssueDecideWrite = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'team.mobile-issue-decide',
    method: 'team.issueDecide',
    acceptance: 'require-result-or-throw',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('decided', z.object({ decided: z.boolean() }))
  })
)
