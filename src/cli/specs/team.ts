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
    summary: 'Answer an issue that waits for you, so its current step continues',
    usage: 'orca team issue answer --issue <issueId> --text <answer> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'issue', 'text'],
    notes: [
      'A session still waiting gets the answer typed in; otherwise the current step starts again with it.',
      'On a Check step that relaunches the review on the same code. To send the work back to a Build step with changes, use orca team issue request-changes.'
    ]
  },
  {
    path: ['team', 'issue', 'request-changes'],
    summary: 'Send an issue waiting after a Check step back to a Build step with changes',
    usage:
      'orca team issue request-changes --issue <issueId> --text <changes> [--step <buildStep>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'issue', 'text', 'step'],
    notes: [
      'Same as Request changes in the board: works on issues ready, escalated or blocked after a Check step, starts a new round and the text becomes the instructions for the Build step.',
      'Goes to the closest Build step before the current one, or to --step, a Build step of the same team before it. Then the issue runs through the Check steps again.',
      'An issue already in a Build step is an error: answer it with orca team issue answer. Going past the rounds per issue is allowed and warned about.'
    ],
    examples: [
      'orca team issue request-changes --issue #125 --text "Bump the version in the changelog"'
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
    summary: 'Move issues back to Not approved, even if they already started',
    usage: 'orca team issue hold --issue <issueId>... [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'issue'],
    repeatableFlags: ['issue'],
    notes: [
      'A started issue keeps its step, round, history, branch and worktree; a running session is stopped. Approve it again to continue from that step.',
      'An issue that passed every step cannot be held: mark it done or request changes.'
    ]
  },
  {
    path: ['team', 'issue', 'update'],
    summary: 'Change the title, description, criteria, dependencies or exclusivity of an issue',
    usage:
      'orca team issue update --issue <issueId> [--title <text>] [--body <text>] [--criterion <text>]... [--depends-on <issueId>]... [--no-dependencies] [--exclusive | --exclusive-team | --shared] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'issue',
      'title',
      'body',
      'criterion',
      'depends-on',
      'no-dependencies',
      'exclusive',
      'exclusive-team',
      'shared'
    ],
    repeatableFlags: ['criterion', 'depends-on'],
    notes: [
      '--criterion and --depends-on replace the whole list; --no-dependencies clears the dependencies.',
      '--exclusive locks the whole project, --exclusive-team only the queue of its own team, --shared neither. Folder projects stay exclusive.'
    ],
    examples: [
      'orca team issue update --issue #48 --no-dependencies',
      'orca team issue update --issue #49 --exclusive-team'
    ]
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
      'orca team issue add --repo <repoId> --team <teamId> --title <text> [--body <text>] [--criterion <text>]... [--exclusive | --exclusive-team] [--depends-on <issueId>]... [--tracker-key <key>] [--tracker-url <url>] [--approved] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'repo',
      'team',
      'title',
      'body',
      'criterion',
      'exclusive',
      'exclusive-team',
      'depends-on',
      'tracker-key',
      'tracker-url',
      'approved'
    ],
    repeatableFlags: ['criterion', 'depends-on'],
    notes: [
      'Without --approved the issue is registered and waits for approval in the Team view.',
      '--exclusive keeps every other issue of the project, of any team, from running beside it (refactors, upgrades).',
      '--exclusive-team only holds the queue of its own team; other teams of the project keep working. Dependencies always cross teams.'
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
