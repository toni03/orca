import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

const Finding = z.object({
  severity: z.enum(['blocker', 'major', 'minor', 'info']),
  message: z.string().min(1),
  file: z.string().optional(),
  line: z.number().int().positive().optional()
})

export const AgentTeamReportParams = z.object({
  assignmentId: requiredString('Missing --assignment'),
  result: z.enum(['done', 'blocked', 'pass', 'changes']),
  summary: requiredString('Missing --summary'),
  questions: z.array(z.string()).optional(),
  options: z.array(z.string().trim().min(1).max(80)).max(4).optional(),
  mergeRequestUrl: z.string().optional(),
  findings: z.array(Finding).optional()
})

export const AgentTeamIssueListParams = z.object({
  status: z.enum(['registered', 'queued', 'working', 'needs-you', 'done', 'discarded']).optional()
})

export const AgentTeamIssueCreateParams = z.object({
  repoId: requiredString('Missing --repo'),
  teamId: requiredString('Missing --team'),
  title: requiredString('Missing --title'),
  body: z.string().optional(),
  criteria: z.array(z.string()).optional(),
  scope: z.enum(['shared', 'exclusive']).optional(),
  dependsOn: z.array(z.string()).optional(),
  trackerKey: z.string().optional(),
  trackerUrl: z.string().optional(),
  approved: z.boolean().optional()
})

export const AgentTeamContextParams = z.object({})

export const AgentTeamSeatPauseParams = z.object({
  seatIds: z.array(z.string()).optional(),
  /** Every active seat running this agent CLI, for example when its plan is out of credits. */
  agent: z.string().optional(),
  paused: z.boolean()
})

/** A Needs you decision from a client without the CLI, e.g. Orca Mobile. */
export const AgentTeamIssueDecideParams = z.object({
  issueId: requiredString('Missing issueId'),
  decision: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('resume') }),
    z.object({ kind: z.literal('answer'), note: z.string().trim().min(1) }),
    z.object({ kind: z.literal('request-changes'), note: z.string().trim().min(1) }),
    z.object({ kind: z.literal('done') }),
    z.object({ kind: z.literal('discard') })
  ])
})

export const AgentTeamIssueAnswerParams = z.object({
  issueId: requiredString('Missing --issue'),
  text: requiredString('Missing --text')
})
