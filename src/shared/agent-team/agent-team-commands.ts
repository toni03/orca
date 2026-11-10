import type { AgentTeamUserDecision } from './agent-team-pipeline'
import {
  addSeat,
  addTeamStep,
  createTeam,
  deleteTeam,
  removeTeamStep,
  renameTeam,
  setSeatsPaused,
  setTeamPaused,
  retireSeat,
  updateSeat,
  updateTeamStep
} from './agent-team-mutations'
import {
  approveIssues,
  createIssue,
  holdIssues,
  reorderQueue,
  updateIssueDetails,
  updateWorkflow,
  upsertProject,
  type AgentTeamIssueInput
} from './agent-team-issue-mutations'
import {
  createRole,
  deleteRole,
  resetRoleToTemplate,
  updateRole
} from './agent-team-role-mutations'
import type {
  AgentTeamIssueScope,
  AgentTeamProject,
  AgentTeamState,
  AgentTeamStepResult,
  AgentTeamStepType,
  AgentTeamTrackerRef,
  AgentTeamWorkflow
} from './agent-team-types'
import type { TuiAgent } from '../agent-launch/catalog/tui-agent'

/** Changes that only touch the saved state. */
export type AgentTeamStateCommand =
  | { kind: 'team.create'; name: string; templateId?: string }
  | { kind: 'team.rename'; teamId: string; name: string }
  | { kind: 'team.pause'; teamId: string; paused: boolean }
  | { kind: 'team.delete'; teamId: string }
  | { kind: 'step.add'; teamId: string; name: string; roleId: string }
  | { kind: 'step.update'; teamId: string; stepId: string; name?: string; roleId?: string }
  | { kind: 'step.remove'; teamId: string; stepId: string }
  | {
      kind: 'seat.add'
      teamId: string
      stepId: string
      name: string
      agent: TuiAgent
      model?: string
    }
  | {
      kind: 'seat.update'
      seatId: string
      name?: string
      model?: string | null
      instructions?: string
    }
  | { kind: 'seat.retire'; seatId: string }
  | { kind: 'seat.pause'; seatIds: string[]; paused: boolean }
  | { kind: 'role.create'; name: string; stepType: AgentTeamStepType; prompt: string }
  | {
      kind: 'role.update'
      roleId: string
      name?: string
      prompt?: string
      skills?: string[]
      stepType?: AgentTeamStepType
    }
  | { kind: 'role.reset'; roleId: string }
  | { kind: 'role.delete'; roleId: string }
  | { kind: 'project.update'; repoId: string; patch: Partial<Omit<AgentTeamProject, 'repoId'>> }
  | ({ kind: 'issue.create' } & AgentTeamIssueInput)
  | {
      kind: 'issue.update'
      issueId: string
      title?: string
      body?: string
      criteria?: string[]
      scope?: AgentTeamIssueScope
      tracker?: AgentTeamTrackerRef
      dependsOn?: string[]
    }
  | { kind: 'issue.approve'; issueIds: string[] }
  | { kind: 'issue.hold'; issueIds: string[] }
  | { kind: 'queue.reorder'; issueIds: string[] }
  | { kind: 'workflow.update'; patch: Partial<AgentTeamWorkflow> }

/** Changes the engine performs because they start or end sessions. */
export type AgentTeamEngineCommand =
  | { kind: 'issue.decide'; issueId: string; decision: AgentTeamUserDecision }
  | { kind: 'assignment.report'; assignmentId: string; result: AgentTeamStepResult }

export type AgentTeamCommand = AgentTeamStateCommand | AgentTeamEngineCommand

export function isAgentTeamEngineCommand(
  command: AgentTeamCommand
): command is AgentTeamEngineCommand {
  return command.kind === 'issue.decide' || command.kind === 'assignment.report'
}

export function applyAgentTeamStateCommand(
  state: AgentTeamState,
  command: AgentTeamStateCommand,
  ids: { newId: () => string; now: number }
): AgentTeamState {
  switch (command.kind) {
    case 'team.create':
      return createTeam(state, command, ids)
    case 'team.rename':
      return renameTeam(state, command.teamId, command.name)
    case 'team.pause':
      return setTeamPaused(state, command.teamId, command.paused)
    case 'team.delete':
      return deleteTeam(state, command.teamId, ids.now)
    case 'step.add':
      return addTeamStep(state, command.teamId, command, ids)
    case 'step.update':
      return updateTeamStep(state, command.teamId, command.stepId, command)
    case 'step.remove':
      return removeTeamStep(state, command.teamId, command.stepId)
    case 'seat.add':
      return addSeat(state, command, ids)
    case 'seat.update':
      return updateSeat(state, command.seatId, command)
    case 'seat.retire':
      return retireSeat(state, command.seatId, ids.now)
    case 'seat.pause':
      return setSeatsPaused(state, command.seatIds, command.paused)
    case 'role.create':
      return createRole(state, command, ids)
    case 'role.update':
      return updateRole(state, command.roleId, command, ids.now)
    case 'role.reset':
      return resetRoleToTemplate(state, command.roleId, ids.now)
    case 'role.delete':
      return deleteRole(state, command.roleId)
    case 'project.update':
      return upsertProject(state, command.repoId, command.patch)
    case 'issue.create':
      return createIssue(state, command, ids).state
    case 'issue.update':
      return updateIssueDetails(state, command.issueId, command, ids.now)
    case 'issue.approve':
      return approveIssues(state, command.issueIds, ids.now)
    case 'issue.hold':
      return holdIssues(state, command.issueIds, ids.now)
    case 'queue.reorder':
      return reorderQueue(state, command.issueIds)
    case 'workflow.update':
      return updateWorkflow(state, command.patch)
  }
}
