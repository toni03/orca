import { defineMethod } from '../core'
import {
  AgentTeamIssueCreateParams,
  AgentTeamContextParams,
  AgentTeamIssueAnswerParams,
  AgentTeamIssueDecideParams,
  AgentTeamIssueIdsParams,
  AgentTeamIssueListParams,
  AgentTeamIssueUpdateParams,
  AgentTeamReportParams,
  AgentTeamSeatPauseParams
} from '../../../../shared/rpc-contract/agent-team-params'
import type {
  AgentTeamState,
  AgentTeamStepResult
} from '../../../../shared/agent-team/agent-team-types'
import { requireAgentTeamService } from '../../../agent-team/agent-team-service-registry'

/** An issue by its Orca id or, when unambiguous, its tracker key (`#48`, `API-128`). */
function resolveIssueId(state: AgentTeamState, ref: string): string {
  const wanted = ref.trim()
  if (state.issues.some((issue) => issue.id === wanted)) {
    return wanted
  }
  const key = wanted.replace(/^#/, '').toLowerCase()
  const matches = state.issues.filter(
    (issue) =>
      issue.status !== 'discarded' && issue.tracker?.key.replace(/^#/, '').toLowerCase() === key
  )
  if (matches.length === 1) {
    return matches[0].id
  }
  throw new Error(
    matches.length > 1
      ? `${ref} matches several issues; pass the issue id from orca team issues.`
      : `No issue ${ref}. Run orca team issues to list them.`
  )
}

function stepResult(params: {
  result: 'done' | 'blocked' | 'pass' | 'changes'
  summary: string
  questions?: string[]
  options?: string[]
  mergeRequestUrl?: string
  findings?: Extract<AgentTeamStepResult, { kind: 'changes' }>['findings']
}): AgentTeamStepResult {
  switch (params.result) {
    case 'done':
      return {
        kind: 'done',
        summary: params.summary,
        ...(params.mergeRequestUrl ? { mergeRequestUrl: params.mergeRequestUrl } : {})
      }
    case 'blocked':
      return {
        kind: 'blocked',
        summary: params.summary,
        questions: params.questions ?? [],
        ...(params.options && params.options.length > 0 ? { options: params.options } : {})
      }
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
    name: 'team.issueAnswer',
    permission: 'workspace',
    params: AgentTeamIssueAnswerParams,
    handler: (params) => {
      requireAgentTeamService().execute({
        kind: 'issue.decide',
        issueId: resolveIssueId(requireAgentTeamService().getState(), params.issueId),
        decision: { kind: 'answer', note: params.text }
      })
      return { answered: true }
    }
  }),
  defineMethod({
    name: 'team.issueDecide',
    permission: 'workspace',
    params: AgentTeamIssueDecideParams,
    handler: (params) => {
      requireAgentTeamService().execute({
        kind: 'issue.decide',
        issueId: resolveIssueId(requireAgentTeamService().getState(), params.issueId),
        decision: params.decision
      })
      return { decided: true }
    }
  }),
  defineMethod({
    name: 'team.seatPause',
    permission: 'workspace',
    params: AgentTeamSeatPauseParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const requested = new Set(params.seatIds ?? [])
      const seats = service
        .getState()
        .seats.filter(
          (seat) =>
            seat.retiredAt === undefined &&
            (requested.has(seat.id) || (params.agent !== undefined && seat.agent === params.agent))
        )
      const unknown = [...requested].filter((id) => !seats.some((seat) => seat.id === id))
      if (unknown.length > 0) {
        throw new Error(
          `No active seat ${unknown.join(', ')}. Run orca team context to list seats.`
        )
      }
      service.execute({
        kind: 'seat.pause',
        seatIds: seats.map((seat) => seat.id),
        paused: params.paused
      })
      return { seats: seats.map((seat) => seat.name) }
    }
  }),
  defineMethod({
    name: 'team.issues',
    permission: 'workspace',
    params: AgentTeamIssueListParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const state = service.getState()
      return {
        issues: state.issues.filter((issue) => !params.status || issue.status === params.status),
        teams: state.teams.map((team) => ({ id: team.id, name: team.name })),
        seats: state.seats.map((seat) => ({ id: seat.id, name: seat.name })),
        projects: service.projectLabels()
      }
    }
  }),
  defineMethod({
    name: 'team.issueApprove',
    permission: 'workspace',
    params: AgentTeamIssueIdsParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const issueIds = params.issueIds.map((ref) => resolveIssueId(service.getState(), ref))
      const state = service.execute({ kind: 'issue.approve', issueIds })
      return { issues: state.issues.filter((issue) => issueIds.includes(issue.id)) }
    }
  }),
  defineMethod({
    name: 'team.issueHold',
    permission: 'workspace',
    params: AgentTeamIssueIdsParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const issueIds = params.issueIds.map((ref) => resolveIssueId(service.getState(), ref))
      const state = service.execute({ kind: 'issue.hold', issueIds })
      return { issues: state.issues.filter((issue) => issueIds.includes(issue.id)) }
    }
  }),
  defineMethod({
    name: 'team.issueUpdate',
    permission: 'workspace',
    params: AgentTeamIssueUpdateParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const current = service.getState()
      const issueId = resolveIssueId(current, params.issueId)
      const state = service.execute({
        kind: 'issue.update',
        issueId,
        ...(params.title !== undefined ? { title: params.title } : {}),
        ...(params.body !== undefined ? { body: params.body } : {}),
        ...(params.criteria ? { criteria: params.criteria } : {}),
        ...(params.dependsOn
          ? { dependsOn: params.dependsOn.map((ref) => resolveIssueId(current, ref)) }
          : {})
      })
      return { issue: state.issues.find((issue) => issue.id === issueId) ?? null }
    }
  }),
  defineMethod({
    name: 'team.issueDiscard',
    permission: 'workspace',
    params: AgentTeamIssueIdsParams,
    handler: (params) => {
      const service = requireAgentTeamService()
      const issueIds = params.issueIds.map((ref) => resolveIssueId(service.getState(), ref))
      for (const issueId of issueIds) {
        service.execute({ kind: 'issue.decide', issueId, decision: { kind: 'discard' } })
      }
      return { discarded: issueIds }
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
