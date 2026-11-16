import type { CommandSpec } from '../discovery/command-spec'
import { CLI_GLOBAL_FLAGS as GLOBAL_FLAGS } from '../../shared/cli-argument-boundary'

export const TEAM_STRUCTURE_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['team', 'show'],
    summary: 'Show a team with its steps, roles and seats',
    usage: 'orca team show --team <teamId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team'],
    notes: ['A team is its Orca id or its name when only one team has it.']
  },
  {
    path: ['team', 'create'],
    summary: 'Create an agent team, empty or from a template',
    usage: 'orca team create --name <text> [--template <development|security|design>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'name', 'template'],
    notes: [
      'A template brings its steps and roles; seats are added afterwards with orca team seat add.'
    ],
    examples: ['orca team create --name Mobile --template development']
  },
  {
    path: ['team', 'update'],
    summary: 'Rename an agent team',
    usage: 'orca team update --team <teamId> --name <text> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'name']
  },
  {
    path: ['team', 'delete'],
    summary: 'Delete an agent team that has no issue in progress, retiring its seats',
    usage: 'orca team delete --team <teamId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team']
  },
  {
    path: ['team', 'step', 'add'],
    summary: 'Add a step to a team',
    usage:
      'orca team step add --team <teamId> --name <text> --role <roleId> [--position <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'name', 'role', 'position'],
    notes: [
      'The role decides whether the step builds or checks; orca team roles lists them.',
      'Without --position the step goes last. Add seats to it with orca team seat add.'
    ],
    examples: [
      'orca team step add --team Development --name "Security review" --role "Security auditor"'
    ]
  },
  {
    path: ['team', 'step', 'update'],
    summary: 'Rename a step, change its role or move it',
    usage:
      'orca team step update --team <teamId> --step <stepId> [--name <text>] [--role <roleId>] [--position <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'step', 'name', 'role', 'position'],
    notes: ['Steps cannot move while the team is working on issues.'],
    examples: ['orca team step update --team Development --step QA --position 3']
  },
  {
    path: ['team', 'step', 'remove'],
    summary: 'Remove a step from a team and retire its seats',
    usage: 'orca team step remove --team <teamId> --step <stepId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'step'],
    notes: ['Steps cannot be removed while the team is working on issues.']
  },
  {
    path: ['team', 'seat', 'add'],
    summary: 'Add a seat (one agent) to a team step',
    usage:
      'orca team seat add --team <teamId> --step <stepId> --agent <agent> [--name <text>] [--model <model>] [--effort <level>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'step', 'agent', 'name', 'model', 'effort'],
    notes: [
      'The agent CLI is its Orca id (claude, codex, gemini…) and cannot change later.',
      'Model and effort are the ids the agent CLI accepts (for example opus and high for Claude), not their display names; leave them out for the agent default.'
    ],
    examples: [
      'orca team seat add --team Development --step Develop --agent claude --name "Dev 2" --model opus'
    ]
  },
  {
    path: ['team', 'seat', 'retire'],
    summary: 'Retire a seat: it leaves its step and takes no more work',
    usage: 'orca team seat retire --seat <seatId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'seat'],
    notes: ['A step already running on the seat finishes; the seat takes nothing new.']
  },
  {
    path: ['team', 'roles'],
    summary: 'List the agent team roles and the team steps that use them',
    usage: 'orca team roles [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['team', 'role', 'show'],
    summary: 'Show a role with its prompt and skills',
    usage: 'orca team role show --role <roleId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'role'],
    notes: ['A role is its Orca id or its name when only one role has it.']
  },
  {
    path: ['team', 'role', 'create'],
    summary: 'Create an agent team role',
    usage:
      'orca team role create --name <text> --type <build|check> [--prompt <text> | --prompt-file <file>] [--skill <name>]... [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'name', 'type', 'prompt', 'prompt-file', 'skill'],
    repeatableFlags: ['skill'],
    notes: [
      'Build steps edit code in their own worktree; Check steps read and test the Build worktree.'
    ]
  },
  {
    path: ['team', 'role', 'update'],
    summary: 'Change the name, step type, prompt or skills of a role',
    usage:
      'orca team role update --role <roleId> [--name <text>] [--type <build|check>] [--prompt <text> | --prompt-file <file>] [--skill <name>]... [--no-skills] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'role',
      'name',
      'type',
      'prompt',
      'prompt-file',
      'skill',
      'no-skills'
    ],
    repeatableFlags: ['skill'],
    notes: [
      'A new prompt bumps the role version; sessions already running keep the version they started with.',
      '--skill replaces the whole list; --no-skills clears it.'
    ],
    examples: ['orca team role update --role Reviewer --prompt-file reviewer.md']
  },
  {
    path: ['team', 'role', 'reset'],
    summary: 'Reset a role copied from a template back to the template',
    usage: 'orca team role reset --role <roleId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'role']
  },
  {
    path: ['team', 'role', 'delete'],
    summary: 'Delete a role no team step uses',
    usage: 'orca team role delete --role <roleId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'role'],
    notes: ['Roles from a template cannot be deleted; reset them instead.']
  }
]
