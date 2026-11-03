import { defineMethod } from '../core'
import {
  AgentTeamIssueCreateParams,
  AgentTeamContextParams,
  AgentTeamIssueListParams,
  AgentTeamReportParams
} from '../../../../shared/rpc-contract/agent-team-params'
import type { AgentTeamStepResult } from '../../../../shared/agent-team/agent-team-types'
import { requireAgentTeamService } from '../../../agent-team/agent-team-service-registry'

function stepResult(params: {
  result: 'done' | 'blocked' | 'pass' | 'changes'
  summary: string
  questions?: string[]
  findings?: Extract<AgentTeamStepResult, { kind: 'changes' }>['findings']
}): AgentTeamStepResult {
  switch (params.result) {
    case 'done':
      return { kind: 'done', summary: params.summary }
    case 'blocked':
      return { kind: 'blocked', summary: params.summary, questions: params.questions ?? [] }
    case 'pass':
      return { kind: 'pass', summary: params.summary, findings: params.findings ?? [] }
    case 'changes':
      return { kind: 'changes', summary: params.summary, findings: params.findings ?? [] }
  }
}

export const AGENT_TEAM_METHODS = [
  defineMethod({
    name: 'team.context',
    permission: 'workspace',
    params: AgentTeamContextParams,
    handler: () => requireAgentTeamService().context()
  }),
  defineMethod({
    name: 'team.report',
    permission: 'workspace',
    params: AgentTeamReportParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      service.execute({
        kind: 'assignment.report',
        assignmentId: params.assignmentId,
        result: stepResult(params)
      })
      return { reported: true }
    }
  }),
  defineMethod({
    name: 'team.issues',
    permission: 'workspace',
    params: AgentTeamIssueListParams,
    handler: (params) => {
      const state = requireAgentTeamService().getState()
      return {
        issues: state.issues.filter((issue) => !params.status || issue.status === params.status),
        teams: state.teams.map((team) => ({ id: team.id, name: team.name }))
      }
    }
  }),
  defineMethod({
    name: 'team.issueCreate',
    permission: 'workspace',
    params: AgentTeamIssueCreateParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const before = new Set(service.getState().issues.map((issue) => issue.id))
      const provider = service
        .getState()
        .projects.find((project) => project.repoId === params.repoId)?.tracker?.provider
      if (params.trackerKey && !provider) {
        throw new Error(
          'Link a tracker to this project in Team settings before recording a tracker key.'
        )
      }
      const state = service.execute({
        kind: 'issue.create',
        repoId: params.repoId,
        teamId: params.teamId,
        title: params.title,
        ...(params.body !== undefined ? { body: params.body } : {}),
        ...(params.criteria ? { criteria: params.criteria } : {}),
        ...(params.scope ? { scope: params.scope } : {}),
        ...(params.dependsOn ? { dependsOn: params.dependsOn } : {}),
        ...(params.trackerKey && provider
          ? {
              tracker: {
                provider,
                key: params.trackerKey,
                ...(params.trackerUrl ? { url: params.trackerUrl } : {})
              }
            }
          : {}),
        ...(params.approved ? { approved: true } : {})
      })
      return { issue: state.issues.find((issue) => !before.has(issue.id)) ?? null }
    }
  })
]
