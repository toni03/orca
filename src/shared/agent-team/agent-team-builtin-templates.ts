import type { AgentTeamRole, AgentTeamState, AgentTeamStepType } from './agent-team-types'

type BuiltinRoleTemplate = {
  id: string
  name: string
  stepType: AgentTeamStepType
  prompt: string
}

export const BUILTIN_ROLE_TEMPLATES: readonly BuiltinRoleTemplate[] = [
  {
    id: 'builtin:developer',
    name: 'Developer',
    stepType: 'build',
    prompt: [
      'You implement one issue in its own worktree.',
      'Read AGENTS.md first and follow the project conventions.',
      'Keep the change focused; add tests for new behaviour.',
      'Follow the project spec for checks, branches and tracker rules.',
      'If the issue is ambiguous, stop and report blocked with your questions.',
      'Never push, never touch CI or secrets.'
    ].join('\n')
  },
  {
    id: 'builtin:qa',
    name: 'QA',
    stepType: 'check',
    prompt: [
      'You verify that the change in this worktree meets the acceptance criteria.',
      "Run the project's tests and any checks the project spec names.",
      'Exercise the changed behaviour; look for regressions near the change.',
      'Do not edit code. Report pass, or changes with concrete findings.'
    ].join('\n')
  },
  {
    id: 'builtin:senior-reviewer',
    name: 'Senior reviewer',
    stepType: 'check',
    prompt: [
      'You review the change in this worktree against its base branch.',
      'Check correctness, security, error handling, naming and test quality.',
      'Do not edit code. Report pass, or changes with findings that cite file and line.',
      'Rank findings: blocker, major, minor, info. Only blocker and major require changes.'
    ].join('\n')
  },
  {
    id: 'builtin:security-auditor',
    name: 'Security auditor',
    stepType: 'check',
    prompt: [
      'You audit the change in this worktree for security issues.',
      'Look for injection, authz gaps, secret exposure, unsafe deserialization and dependency risk.',
      'Do not edit code. Report pass, or changes with findings that cite file and line.'
    ].join('\n')
  },
  {
    id: 'builtin:designer',
    name: 'Designer',
    stepType: 'build',
    prompt: [
      'You implement the UI part of one issue in its own worktree.',
      "Follow the project's style guide and existing components before adding new ones.",
      'Keep light and dark themes and small screens working.',
      'If the design intent is unclear, stop and report blocked with your questions.'
    ].join('\n')
  }
]

type BuiltinTeamTemplate = {
  id: string
  name: string
  steps: { name: string; roleTemplateId: string }[]
}

export const BUILTIN_TEAM_TEMPLATES: readonly BuiltinTeamTemplate[] = [
  {
    id: 'builtin:development',
    name: 'Development',
    steps: [
      { name: 'Develop', roleTemplateId: 'builtin:developer' },
      { name: 'QA', roleTemplateId: 'builtin:qa' },
      { name: 'Senior review', roleTemplateId: 'builtin:senior-reviewer' }
    ]
  },
  {
    id: 'builtin:security',
    name: 'Security',
    steps: [
      { name: 'Fix', roleTemplateId: 'builtin:developer' },
      { name: 'Audit', roleTemplateId: 'builtin:security-auditor' }
    ]
  },
  {
    id: 'builtin:design',
    name: 'Design',
    steps: [
      { name: 'Design', roleTemplateId: 'builtin:designer' },
      { name: 'Review', roleTemplateId: 'builtin:senior-reviewer' }
    ]
  }
]

export function builtinRole(template: BuiltinRoleTemplate, now: number): AgentTeamRole {
  return {
    id: template.id,
    name: template.name,
    stepType: template.stepType,
    prompt: template.prompt,
    skills: [],
    version: 1,
    origin: 'builtin',
    templateId: template.id,
    templateVersion: 1,
    updatedAt: now
  }
}

export function createInitialAgentTeamState(now: number): AgentTeamState {
  return {
    version: 1,
    roles: BUILTIN_ROLE_TEMPLATES.map((template) => builtinRole(template, now)),
    teams: [],
    seats: [],
    projects: [],
    issues: [],
    workflow: { roundsPerIssue: 3, batchThreshold: 2, paused: false }
  }
}
