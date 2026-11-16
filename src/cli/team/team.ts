import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { AgentTeamIssue } from '../../shared/agent-team/agent-team-types'
import type { AgentTeamContext } from '../../shared/agent-team/agent-team-context'
import type { CommandHandler } from '../dispatch/dispatch'
import {
  getOptionalStringFlag,
  getRepeatedStringFlag,
  getRequiredStringFlag
} from '../arguments/flags'
import { printResult } from '../output/command-result-output'
import { TEAM_CONFIG_HANDLERS } from './team-config'
import { TEAM_STRUCTURE_HANDLERS } from './team-structure'

const RESULTS = ['done', 'blocked', 'pass', 'changes'] as const

function isResult(value: string): value is (typeof RESULTS)[number] {
  return RESULTS.some((result) => result === value)
}

async function readFindings(path: string, cwd: string): Promise<unknown> {
  const text = await readFile(resolve(cwd, path), 'utf8')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${path} is not valid JSON.`)
  }
}

type IssueListReply = {
  issues: AgentTeamIssue[]
  teams: { id: string; name: string }[]
  /** Why each queued issue has not started, by issue id. */
  waiting?: Record<string, string>
}

function formatIssues(result: IssueListReply): string {
  if (result.issues.length === 0) {
    return 'No issues.'
  }
  return result.issues
    .map((issue) => {
      const team = result.teams.find((candidate) => candidate.id === issue.teamId)?.name ?? '?'
      const key = issue.tracker?.key ? ` ${issue.tracker.key}` : ''
      const waiting = result.waiting?.[issue.id] ? `  (${result.waiting[issue.id]})` : ''
      return `${issue.id}${key}  [${issue.status}]  ${team} · round ${issue.round}  ${issue.title}${waiting}`
    })
    .join('\n')
}

function formatIssueStates(issues: AgentTeamIssue[]): string {
  return issues
    .map((issue) => {
      const key = issue.tracker?.key ? ` ${issue.tracker.key}` : ''
      const deps = issue.dependsOn.length > 0 ? `  depends on ${issue.dependsOn.join(', ')}` : ''
      return `${issue.id}${key}  [${issue.status}]  ${issue.title}${deps}`
    })
    .join('\n')
}

function formatContext(context: AgentTeamContext): string {
  const projects = context.projects.map((project) => {
    const tracker = project.tracker?.provider ?? 'no tracker'
    const group = project.groupRepos
      ? `  group: ${project.groupRepos.map((repo) => repo.name).join(', ')}`
      : ''
    return `${project.repoId}  ${project.name}  ${tracker}${project.spec ? '  spec' : ''}${group}`
  })
  const teams = context.teams.flatMap((team) => [
    `${team.id}  ${team.name}${team.paused ? ' (paused)' : ''}: ${team.steps.map((step) => step.name).join(' -> ')}`,
    ...team.steps.flatMap((step) =>
      step.seats.map(
        (seat) =>
          `  ${step.name}: ${seat.id}  ${seat.name} (${[seat.agent, seat.model, seat.effort].filter(Boolean).join(' · ')})${seat.paused ? ' paused' : ''}`
      )
    )
  ])
  return [
    'Projects:',
    ...projects,
    '',
    'Teams:',
    ...teams,
    '',
    `Queue: ${context.queue.length} open issues (use --json for specs and the queue)`
  ].join('\n')
}

/** --exclusive locks the whole project, --exclusive-team only the issue's own team, --shared neither. */
function scopeFlag(
  flags: Map<string, string | boolean>
): { scope: 'shared' | 'exclusive-team' | 'exclusive' } | Record<string, never> {
  const chosen = (['exclusive', 'exclusive-team', 'shared'] as const).filter(
    (flag) => flags.get(flag) === true
  )
  if (chosen.length > 1) {
    throw new Error('Pass only one of --exclusive, --exclusive-team or --shared.')
  }
  return chosen[0] ? { scope: chosen[0] } : {}
}

type SeatPauseReply = { seats: string[] }

function seatTarget(
  flags: Map<string, string | boolean>,
  paused: boolean
): { seatIds: string[]; agent?: string; paused: boolean } {
  const seatIds = getRepeatedStringFlag(flags, 'seat')
  const agent = getOptionalStringFlag(flags, 'agent')
  if (seatIds.length === 0 && !agent) {
    throw new Error('Pass --seat <seatId> or --agent <agent>.')
  }
  return { seatIds, ...(agent ? { agent } : {}), paused }
}

export const TEAM_HANDLERS: Record<string, CommandHandler> = {
  'team context': async ({ client, json }) => {
    const response = await client.call<AgentTeamContext>('team.context', {})
    printResult(response, json, formatContext)
  },
  'team report': async ({ flags, client, cwd, json }) => {
    const result = getRequiredStringFlag(flags, 'result')
    if (!isResult(result)) {
      throw new Error(`--result must be one of ${RESULTS.join(', ')}.`)
    }
    const findingsPath = getOptionalStringFlag(flags, 'findings')
    const mergeRequestUrls = getRepeatedStringFlag(flags, 'merge-request')
    const response = await client.call<{ reported: boolean }>('team.report', {
      assignmentId: getRequiredStringFlag(flags, 'assignment'),
      result,
      summary: getRequiredStringFlag(flags, 'summary'),
      questions: getRepeatedStringFlag(flags, 'question'),
      options: getRepeatedStringFlag(flags, 'option'),
      ...(mergeRequestUrls.length > 0
        ? { mergeRequestUrl: mergeRequestUrls[0], mergeRequestUrls }
        : {}),
      ...(findingsPath ? { findings: await readFindings(findingsPath, cwd) } : {})
    })
    printResult(response, json, () => 'Reported. Orca moves the issue to its next step.')
  },
  'team issues': async ({ flags, client, json }) => {
    const status = getOptionalStringFlag(flags, 'status')
    const response = await client.call<IssueListReply>('team.issues', status ? { status } : {})
    printResult(response, json, formatIssues)
  },
  'team issue answer': async ({ flags, client, json }) => {
    const response = await client.call<{ answered: boolean }>('team.issueAnswer', {
      issueId: getRequiredStringFlag(flags, 'issue'),
      text: getRequiredStringFlag(flags, 'text')
    })
    printResult(response, json, () => 'Answered. The step continues with your answer.')
  },
  'team issue approve': async ({ flags, client, json }) => {
    const response = await client.call<{ issues: AgentTeamIssue[] }>('team.issueApprove', {
      issueIds: getRepeatedStringFlag(flags, 'issue')
    })
    printResult(response, json, (result) => formatIssueStates(result.issues))
  },
  'team issue hold': async ({ flags, client, json }) => {
    const response = await client.call<{ issues: AgentTeamIssue[] }>('team.issueHold', {
      issueIds: getRepeatedStringFlag(flags, 'issue')
    })
    printResult(response, json, (result) => formatIssueStates(result.issues))
  },
  'team issue update': async ({ flags, client, json }) => {
    const title = getOptionalStringFlag(flags, 'title')
    const body = getOptionalStringFlag(flags, 'body')
    const criteria = getRepeatedStringFlag(flags, 'criterion')
    const dependsOn = getRepeatedStringFlag(flags, 'depends-on')
    const clearDependencies = flags.get('no-dependencies') === true
    if (clearDependencies && dependsOn.length > 0) {
      throw new Error('Pass --depends-on or --no-dependencies, not both.')
    }
    const response = await client.call<{ issue: AgentTeamIssue | null }>('team.issueUpdate', {
      issueId: getRequiredStringFlag(flags, 'issue'),
      ...(title !== undefined ? { title } : {}),
      ...(body !== undefined ? { body } : {}),
      ...(criteria.length > 0 ? { criteria } : {}),
      ...(dependsOn.length > 0 || clearDependencies ? { dependsOn } : {}),
      ...scopeFlag(flags)
    })
    printResult(response, json, (result) =>
      result.issue ? `Updated ${formatIssueStates([result.issue])}` : 'Updated.'
    )
  },
  'team issue discard': async ({ flags, client, json }) => {
    const response = await client.call<{ discarded: string[] }>('team.issueDiscard', {
      issueIds: getRepeatedStringFlag(flags, 'issue')
    })
    printResult(response, json, (result) => `Discarded: ${result.discarded.join(', ')}.`)
  },
  'team seat pause': async ({ flags, client, json }) => {
    const response = await client.call<SeatPauseReply>('team.seatPause', seatTarget(flags, true))
    printResult(response, json, (result) => `Paused: ${result.seats.join(', ') || 'no seats'}.`)
  },
  'team seat resume': async ({ flags, client, json }) => {
    const response = await client.call<SeatPauseReply>('team.seatPause', seatTarget(flags, false))
    printResult(response, json, (result) => `Resumed: ${result.seats.join(', ') || 'no seats'}.`)
  },
  'team issue add': async ({ flags, client, json }) => {
    const body = getOptionalStringFlag(flags, 'body')
    const trackerKey = getOptionalStringFlag(flags, 'tracker-key')
    const trackerUrl = getOptionalStringFlag(flags, 'tracker-url')
    const response = await client.call<{ issue: AgentTeamIssue | null }>('team.issueCreate', {
      repoId: getRequiredStringFlag(flags, 'repo'),
      teamId: getRequiredStringFlag(flags, 'team'),
      title: getRequiredStringFlag(flags, 'title'),
      ...(body !== undefined ? { body } : {}),
      criteria: getRepeatedStringFlag(flags, 'criterion'),
      dependsOn: getRepeatedStringFlag(flags, 'depends-on'),
      ...scopeFlag(flags),
      ...(trackerKey ? { trackerKey } : {}),
      ...(trackerUrl ? { trackerUrl } : {}),
      ...(flags.get('approved') === true ? { approved: true } : {})
    })
    printResult(response, json, (result) =>
      result.issue
        ? `Added ${result.issue.id} [${result.issue.status}] ${result.issue.title}`
        : 'Added.'
    )
  },
  ...TEAM_CONFIG_HANDLERS,
  ...TEAM_STRUCTURE_HANDLERS
}
