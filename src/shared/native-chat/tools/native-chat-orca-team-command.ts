// The agent team Manager works almost only through `orca team …`; naming those commands keeps its runs readable.

import { nativeChatFullCommand } from './native-chat-tool-input-text'

export type OrcaTeamCommandKind =
  | 'context'
  | 'issues'
  | 'issueAdd'
  | 'issueApprove'
  | 'issueHold'
  | 'issueUpdate'
  | 'issueDiscard'
  | 'issueAnswer'
  | 'seatPause'
  | 'seatResume'
  | 'configRead'
  | 'roleUpdate'
  | 'projectUpdate'
  | 'report'
  | 'other'

const SUBCOMMANDS: Record<string, OrcaTeamCommandKind> = {
  context: 'context',
  issues: 'issues',
  'issue add': 'issueAdd',
  'issue approve': 'issueApprove',
  'issue hold': 'issueHold',
  'issue update': 'issueUpdate',
  'issue discard': 'issueDiscard',
  'issue answer': 'issueAnswer',
  'seat pause': 'seatPause',
  'seat resume': 'seatResume',
  roles: 'configRead',
  'role show': 'configRead',
  'project show': 'configRead',
  'role create': 'roleUpdate',
  'role update': 'roleUpdate',
  'role reset': 'roleUpdate',
  'role delete': 'roleUpdate',
  'project update': 'projectUpdate',
  'group update': 'projectUpdate',
  'group remove': 'projectUpdate',
  report: 'report'
}

// Matches `orca team …` however the CLI is called: bare, by full path, quoted, or as orca.cmd/orca.exe.
const ORCA_TEAM =
  /(?:^|[\s"'&/\\])orca(?:-[a-z]+)?(?:\.cmd|\.exe)?["']?\s+team\s+([a-z]+)(?:\s+([a-z]+))?/i

export function orcaTeamCommandKind(input: unknown): OrcaTeamCommandKind | null {
  const command = nativeChatFullCommand(input)
  const match = command ? ORCA_TEAM.exec(command) : null
  if (!match) {
    return null
  }
  const first = match[1].toLowerCase()
  const second = match[2]?.toLowerCase()
  return (second && SUBCOMMANDS[`${first} ${second}`]) || SUBCOMMANDS[first] || 'other'
}

/** Past and live English copy; desktop translates the same keys. */
export const ORCA_TEAM_COMMAND_COPY: Record<
  OrcaTeamCommandKind,
  { one: string; many: string; live: string }
> = {
  context: {
    one: 'Read the team state',
    many: 'Read the team state {{value0}} times',
    live: 'Reading the team state'
  },
  issues: { one: 'Listed issues', many: 'Listed issues {{value0}} times', live: 'Listing issues' },
  issueAdd: { one: 'Added 1 issue', many: 'Added {{value0}} issues', live: 'Adding issues' },
  issueApprove: {
    one: 'Approved issues',
    many: 'Approved issues {{value0}} times',
    live: 'Approving issues'
  },
  issueHold: { one: 'Held issues', many: 'Held issues {{value0}} times', live: 'Holding issues' },
  issueUpdate: {
    one: 'Updated 1 issue',
    many: 'Updated {{value0}} issues',
    live: 'Updating issues'
  },
  issueDiscard: {
    one: 'Discarded issues',
    many: 'Discarded issues {{value0}} times',
    live: 'Discarding issues'
  },
  issueAnswer: {
    one: 'Answered 1 issue',
    many: 'Answered {{value0}} issues',
    live: 'Answering issues'
  },
  seatPause: { one: 'Paused seats', many: 'Paused seats {{value0}} times', live: 'Pausing seats' },
  seatResume: {
    one: 'Resumed seats',
    many: 'Resumed seats {{value0}} times',
    live: 'Resuming seats'
  },
  configRead: {
    one: 'Read the team settings',
    many: 'Read the team settings {{value0}} times',
    live: 'Reading the team settings'
  },
  roleUpdate: {
    one: 'Changed roles',
    many: 'Changed roles {{value0}} times',
    live: 'Changing roles'
  },
  projectUpdate: {
    one: 'Changed project settings',
    many: 'Changed project settings {{value0}} times',
    live: 'Changing project settings'
  },
  report: { one: 'Reported the step', many: 'Reported {{value0}} times', live: 'Reporting' },
  other: {
    one: 'Ran 1 team command',
    many: 'Ran {{value0}} team commands',
    live: 'Running team commands'
  }
}

export function orcaTeamClauseEnglish(
  kind: OrcaTeamCommandKind,
  count: number,
  live: boolean
): string {
  const copy = ORCA_TEAM_COMMAND_COPY[kind]
  if (live) {
    return copy.live
  }
  return count === 1 ? copy.one : copy.many.replaceAll('{{value0}}', String(count))
}
