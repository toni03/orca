import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { AgentTeamIssue } from '../../shared/agent-team/agent-team-types'
import type { AgentTeamContext } from '../../shared/agent-team/agent-team-context'
import type { CommandHandler } from '../dispatch'
import { getOptionalStringFlag, getRepeatedStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'

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

function formatIssues(result: {
  issues: AgentTeamIssue[]
  teams: { id: string; name: string }[]
}): string {
  if (result.issues.length === 0) {
    return 'No issues.'
  }
  return result.issues
    .map((issue) => {
      const team = result.teams.find((candidate) => candidate.id === issue.teamId)?.name ?? '?'
      const key = issue.tracker?.key ? ` ${issue.tracker.key}` : ''
      return `${issue.id}${key}  [${issue.status}]  ${team} · round ${issue.round}  ${issue.title}`
    })
    .join('\n')
}

function formatContext(context: AgentTeamContext): string {
  const projects = context.projects.map((project) => {
    const tracker = project.tracker?.provider ?? 'no tracker'
    return `${project.repoId}  ${project.name}  ${tracker}${project.spec ? '  spec' : ''}`
  })
  const teams = context.teams.map(
    (team) => `${team.id}  ${team.name}: ${team.steps.map((step) => step.name).join(' -> ')}`
  )
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
    const response = await client.call<{ reported: boolean }>('team.report', {
      assignmentId: getRequiredStringFlag(flags, 'assignment'),
      result,
      summary: getRequiredStringFlag(flags, 'summary'),
      questions: getRepeatedStringFlag(flags, 'question'),
      ...(findingsPath ? { findings: await readFindings(findingsPath, cwd) } : {})
    })
    printResult(response, json, () => 'Reported. Orca moves the issue to its next step.')
  },
  'team issues': async ({ flags, client, json }) => {
    const status = getOptionalStringFlag(flags, 'status')
    const response = await client.call<{
      issues: AgentTeamIssue[]
      teams: { id: string; name: string }[]
    }>('team.issues', status ? { status } : {})
    printResult(response, json, formatIssues)
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
      ...(flags.get('exclusive') === true ? { scope: 'exclusive' } : {}),
      ...(trackerKey ? { trackerKey } : {}),
      ...(trackerUrl ? { trackerUrl } : {}),
      ...(flags.get('approved') === true ? { approved: true } : {})
    })
    printResult(response, json, (result) =>
      result.issue
        ? `Added ${result.issue.id} [${result.issue.status}] ${result.issue.title}`
        : 'Added.'
    )
  }
}
