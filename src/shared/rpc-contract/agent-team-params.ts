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
  mergeRequestUrls: z.array(z.string()).optional(),
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

/** Issues that move between Not approved and the queue together. */
export const AgentTeamIssueIdsParams = z.object({
  issueIds: z.array(z.string().trim().min(1)).min(1, 'Pass --issue <issueId>')
})

export const AgentTeamIssueUpdateParams = z.object({
  issueId: requiredString('Missing --issue'),
  title: z.string().optional(),
  body: z.string().optional(),
  criteria: z.array(z.string()).optional(),
  /** Replaces the dependencies; an empty list clears them. */
  dependsOn: z.array(z.string()).optional()
})

/** A seat by its id or, when unambiguous, its name; its agent CLI is fixed. */
export const AgentTeamSeatUpdateParams = z.object({
  seatId: requiredString('Missing --seat'),
  name: z.string().trim().min(1).optional(),
  /** Null goes back to the agent default. */
  model: z.string().trim().min(1).nullable().optional(),
  effort: z.string().trim().min(1).nullable().optional(),
  instructions: z.string().optional()
})

const StepType = z.enum(['build', 'check'])

/** A role by its id or, when unambiguous, its name. */
export const AgentTeamRoleListParams = z.object({
  roleId: z.string().trim().min(1).optional()
})

export const AgentTeamRoleCreateParams = z.object({
  name: requiredString('Missing --name'),
  stepType: StepType,
  prompt: z.string().optional(),
  skills: z.array(z.string()).optional()
})

export const AgentTeamRoleUpdateParams = z.object({
  roleId: requiredString('Missing --role'),
  name: z.string().trim().min(1).optional(),
  stepType: StepType.optional(),
  prompt: z.string().optional(),
  /** Replaces the skills; an empty list clears them. */
  skills: z.array(z.string()).optional()
})

export const AgentTeamRoleRefParams = z.object({
  roleId: requiredString('Missing --role')
})

/** A project by its repo id or, when unambiguous, its name. */
export const AgentTeamProjectShowParams = z.object({
  repoId: requiredString('Missing --repo')
})

export const AgentTeamProjectUpdateParams = z.object({
  repoId: requiredString('Missing --repo'),
  /** `default` follows the repo's code host; `none` means the project has no tracker. */
  tracker: z.enum(['github', 'gitlab', 'jira', 'linear', 'none', 'default']).optional(),
  /** Jira or Linear project key; an empty string clears it. */
  projectKey: z.string().optional(),
  /** Null goes back to the repo default branch. */
  baseBranch: z.string().trim().min(1).nullable().optional(),
  specStorage: z.enum(['repository', 'local']).optional(),
  spec: z.string().optional()
})

/** An Orca project group by its id or, when unambiguous, its name. */
export const AgentTeamGroupUpdateParams = z.object({
  groupId: requiredString('Missing --group'),
  trackerRepoId: z.string().trim().min(1).optional(),
  /** Replaces the repos that take part; absent keeps them (or takes every git repo of the group). */
  repoIds: z.array(z.string().trim().min(1)).optional()
})

export const AgentTeamGroupRefParams = z.object({
  groupId: requiredString('Missing --group')
})
