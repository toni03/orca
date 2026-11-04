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
      'orca team report --assignment <id> --result <done|blocked|pass|changes> --summary <text> [--question <text>]... [--merge-request <url>] [--findings <file.json>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'assignment',
      'result',
      'summary',
      'question',
      'merge-request',
      'findings'
    ],
    repeatableFlags: ['question'],
    notes: [
      'Build steps report done or blocked; Check steps report pass or changes.',
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
