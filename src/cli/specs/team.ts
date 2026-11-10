import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

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
      'orca team report --assignment <id> --result <done|blocked|pass|changes> --summary <text> [--question <text>]... [--option <answer>]... [--merge-request <url>] [--findings <file.json>] [--json]',
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
    repeatableFlags: ['question', 'option'],
    notes: [
      'Build steps report done or blocked; Check steps report pass or changes.',
      'A blocked report can offer up to 4 short answers with --option (e.g. --option Allow --option Deny); the user picks one with one click.',
      'A Build step that opened a merge or pull request passes its URL with --merge-request.',
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
  }
]
