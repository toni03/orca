import type { CommandSpec } from '../discovery/command-spec'
import { CLI_GLOBAL_FLAGS as GLOBAL_FLAGS } from '../../shared/cli-argument-boundary'

export const TEAM_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['team', 'context'],
    summary: 'Show projects, trackers, project specs, teams and the queue for the Manager',
    usage: 'orca team context [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['team', 'report'],
    summary: 'Report the result of an agent team step you were assigned',
    usage:
      'orca team report --assignment <id> --result <done|blocked|pass|changes> --summary <text> [--question <text>]... [--option <answer>]... [--merge-request <url>]... [--findings <file.json>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'assignment',
      'result',
      'summary',
      'question',
      'option',
      'merge-request',
      'findings'
    ],
    repeatableFlags: ['question', 'option', 'merge-request'],
    notes: [
      'Build steps report done or blocked; Check steps report pass or changes.',
      'A blocked report can offer up to 4 short answers with --option (e.g. --option Allow --option Deny); the user picks one with one click.',
      'A Build step that opened a merge or pull request passes its URL with --merge-request; an issue that spans several repos passes one per repo.',
      'findings.json is an array of {"severity":"blocker|major|minor|info","message":"…","file":"…","line":1}.',
      'The assignment id is in the instructions Orca gave the session.'
    ],
    examples: [
      'orca team report --assignment 6f1c… --result done --summary "Added pagination and tests"',
      'orca team report --assignment 6f1c… --result changes --summary "Missing error handling" --findings findings.json'
    ]
  },
  {
    path: ['team', 'issues'],
    summary: 'List the issues the agent team knows about',
    usage:
      'orca team issues [--status <registered|queued|working|needs-you|done|discarded>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'status']
  },
  {
    path: ['team', 'issue', 'answer'],
    summary: 'Answer an issue that waits for you, so its step continues',
    usage: 'orca team issue answer --issue <issueId> --text <answer> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'issue', 'text'],
    notes: [
      'A session still waiting gets the answer typed in; otherwise the same step starts again with it.'
    ]
  },
  {
    path: ['team', 'issue', 'approve'],
    summary: 'Approve issues so they join the priority queue',
    usage: 'orca team issue approve --issue <issueId>... [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'issue'],
    repeatableFlags: ['issue'],
    notes: [
      'An issue is its Orca id or its tracker key (#48, API-128) when only one issue has it.'
    ],
    examples: ['orca team issue approve --issue #48 --issue #49']
  },
  {
    path: ['team', 'issue', 'hold'],
    summary: 'Move queued issues that have not started back to Not approved',
    usage: 'orca team issue hold --issue <issueId>... [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'issue'],
    repeatableFlags: ['issue'],
    notes: ['Issues a seat already works on cannot be held; discard them or wait.']
  },
  {
    path: ['team', 'issue', 'update'],
    summary: 'Change the title, description, criteria or dependencies of an issue',
    usage:
      'orca team issue update --issue <issueId> [--title <text>] [--body <text>] [--criterion <text>]... [--depends-on <issueId>]... [--no-dependencies] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'issue',
      'title',
      'body',
      'criterion',
      'depends-on',
      'no-dependencies'
    ],
    repeatableFlags: ['criterion', 'depends-on'],
    notes: [
      '--criterion and --depends-on replace the whole list; --no-dependencies clears the dependencies.'
    ],
    examples: ['orca team issue update --issue #48 --no-dependencies']
  },
  {
    path: ['team', 'issue', 'discard'],
    summary: 'Discard issues: they leave the board and any running session stops',
    usage: 'orca team issue discard --issue <issueId>... [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'issue'],
    repeatableFlags: ['issue'],
    notes: [
      'The tracker issue stays as it is; close it there if needed. Orca removes the issue worktree.'
    ]
  },
  {
    path: ['team', 'seat', 'pause'],
    summary: 'Pause agent team seats so they take no new steps',
    usage: 'orca team seat pause (--seat <seatId>... | --agent <agent>) [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'seat', 'agent'],
    repeatableFlags: ['seat'],
    notes: [
      '--agent pauses every active seat that runs that agent CLI, for example when its plan is out of credits. Running steps finish; queued work goes to the seats that are not paused. Seat ids are in orca team context.'
    ],
    examples: ['orca team seat pause --agent codex']
  },
  {
    path: ['team', 'seat', 'resume'],
    summary: 'Resume paused agent team seats',
    usage: 'orca team seat resume (--seat <seatId>... | --agent <agent>) [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'seat', 'agent'],
    repeatableFlags: ['seat'],
    notes: ['--agent resumes every active seat that runs that agent CLI.'],
    examples: ['orca team seat resume --agent codex']
  },
  {
    path: ['team', 'issue', 'add'],
    summary: 'Add an issue to the agent team',
    usage:
      'orca team issue add --repo <repoId> --team <teamId> --title <text> [--body <text>] [--criterion <text>]... [--exclusive] [--depends-on <issueId>]... [--tracker-key <key>] [--tracker-url <url>] [--approved] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'repo',
      'team',
      'title',
      'body',
      'criterion',
      'exclusive',
      'depends-on',
      'tracker-key',
      'tracker-url',
      'approved'
    ],
    repeatableFlags: ['criterion', 'depends-on'],
    notes: [
      'Without --approved the issue is registered and waits for approval in the Team view.',
      '--exclusive keeps other issues of the project from running beside it (refactors, upgrades).'
    ]
  },
  {
    path: ['team', 'seat', 'update'],
    summary: 'Change the name, model, reasoning level or instructions of a seat',
    usage:
      'orca team seat update --seat <seatId> [--name <text>] [--model <model> | --default-model] [--effort <level> | --default-effort] [--instructions <text> | --instructions-file <file>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'seat',
      'name',
      'model',
      'default-model',
      'effort',
      'default-effort',
      'instructions',
      'instructions-file'
    ],
    notes: [
      'A seat is its Orca id or its name when only one seat has it. Its agent CLI cannot change.',
      'Model and effort are the ids the agent CLI accepts (for example opus and high for Claude); they apply from the next session.'
    ],
    examples: ['orca team seat update --seat "Dev 1" --model opus --effort high']
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
  },
  {
    path: ['team', 'project', 'show'],
    summary: 'Show the team settings of a project: tracker, base branch, spec and group',
    usage: 'orca team project show --repo <repoId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'repo'],
    notes: ['A project is its repo id or its name when only one project has it.']
  },
  {
    path: ['team', 'project', 'update'],
    summary: 'Change the tracker, base branch or spec of a project',
    usage:
      'orca team project update --repo <repoId> [--tracker <github|gitlab|jira|linear|none|default>] [--project-key <key>] [--base-branch <branch> | --default-branch] [--spec-storage <repository|local>] [--spec <text> | --spec-file <file>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'repo',
      'tracker',
      'project-key',
      'base-branch',
      'default-branch',
      'spec-storage',
      'spec',
      'spec-file'
    ],
    notes: [
      '--tracker default follows the repo code host; none leaves the project without a tracker.',
      '--project-key is the Jira or Linear project; --project-key "" clears it.',
      'Repository specs are written to .orca/agent-team.md in the project; local specs stay in Orca.',
      'A repo in a group worked as one project takes its settings from the group tracker repo.'
    ],
    examples: [
      'orca team project update --repo api --tracker jira --project-key API',
      'orca team project update --repo api --spec-file spec.md'
    ]
  },
  {
    path: ['team', 'group', 'update'],
    summary: 'Work an Orca project group as one project, or change its tracker repo and repos',
    usage:
      'orca team group update --group <groupId> [--tracker-repo <repoId>] [--repo <repoId>]... [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'group', 'tracker-repo', 'repo'],
    repeatableFlags: ['repo'],
    notes: [
      'Each issue of the group gets a worktree in every repo on one branch; its issues and tracker live in the tracker repo.',
      '--repo replaces the repos that take part; without it a new group takes every git repo of the Orca group.'
    ]
  },
  {
    path: ['team', 'group', 'remove'],
    summary: 'Stop working an Orca project group as one project',
    usage: 'orca team group remove --group <groupId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'group']
  }
]
