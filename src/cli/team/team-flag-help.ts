// `orca team` reuses flag names whose shared help describes worktrees and launches.

function line(usage: string, text: string): string {
  return `${usage.padEnd(22)} ${text}`
}

const TEAM_FLAG_HELP: Record<string, string> = {
  assignment: line(
    '--assignment <id>',
    'Assignment id from the instructions Orca gave the session'
  ),
  result: line('--result <result>', 'Build steps: done or blocked; Check steps: pass or changes'),
  summary: line('--summary <text>', 'What the step did, for the user and the next step'),
  question: line('--question <text>', 'Question for the user when the step is blocked'),
  option: line('--option <answer>', 'Short answer the user can pick with one click (up to 4)'),
  'merge-request': line(
    '--merge-request <url>',
    'Merge or pull request the step opened, one per repo'
  ),
  findings: line('--findings <file>', 'JSON file with the review findings'),
  status: line('--status <status>', 'Only issues in this state'),
  issue: line('--issue <issueId>', 'Issue by Orca id or tracker key (#48, API-128)'),
  text: line('--text <answer>', 'Answer for the step that waits for you'),
  title: line('--title <text>', 'Issue title'),
  body: line('--body <text>', 'Issue description'),
  criterion: line('--criterion <text>', 'Acceptance criterion; repeat for several'),
  'depends-on': line('--depends-on <issueId>', 'Issue that must finish first; repeat for several'),
  'no-dependencies': line('--no-dependencies', 'Clear the issue dependencies'),
  exclusive: line('--exclusive', 'Run alone in its project (refactors, upgrades)'),
  'tracker-key': line('--tracker-key <key>', 'Key of the issue in the project tracker'),
  'tracker-url': line('--tracker-url <url>', 'Link to the issue in the project tracker'),
  approved: line('--approved', 'Queue the issue without waiting for approval'),
  repo: line('--repo <repoId>', 'Project by repo id or name; see orca team context'),
  team: line('--team <teamId>', 'Team by id or name; see orca team context'),
  step: line('--step <stepId>', 'Step of the team by id or name; see orca team show'),
  seat: line('--seat <seatId>', 'Seat by id or name; see orca team context'),
  agent: line('--agent <agent>', 'Agent CLI by its Orca id, for example claude or codex'),
  role: line('--role <roleId>', 'Role by id or name; see orca team roles'),
  name: line('--name <text>', 'Name'),
  type: line('--type <build|check>', 'Build steps edit code; Check steps review and test it'),
  prompt: line('--prompt <text>', 'Role prompt the seats of its steps follow'),
  'prompt-file': line('--prompt-file <path>', 'Read the role prompt from a file'),
  skill: line('--skill <name>', 'Skill the role loads; repeat for several, replaces the list'),
  'no-skills': line('--no-skills', 'Clear the role skills'),
  model: line(
    '--model <model>',
    'Model id the agent CLI accepts, e.g. opus (not its display name)'
  ),
  'default-model': line('--default-model', "Go back to the agent's default model"),
  effort: line('--effort <level>', 'Reasoning level the model offers, e.g. high'),
  'default-effort': line('--default-effort', "Go back to the model's default reasoning level"),
  instructions: line('--instructions <text>', 'Extra instructions for this seat only'),
  'instructions-file': line('--instructions-file <path>', 'Read the seat instructions from a file'),
  tracker: line(
    '--tracker <tracker>',
    'github, gitlab, jira, linear, none, or default (the repo code host)'
  ),
  'project-key': line('--project-key <key>', 'Jira or Linear project; "" clears it'),
  'base-branch': line(
    '--base-branch <branch>',
    'Branch new worktrees start from and requests target'
  ),
  'default-branch': line('--default-branch', "Go back to the repo's default branch"),
  'spec-storage': line(
    '--spec-storage <where>',
    'repository (.orca/agent-team.md) or local (in Orca)'
  ),
  spec: line('--spec <text>', 'Project spec: tracker labels, states, branch names, approval'),
  'spec-file': line('--spec-file <path>', 'Read the project spec from a file'),
  group: line('--group <groupId>', 'Orca project group by id or name'),
  'tracker-repo': line(
    '--tracker-repo <repoId>',
    'Repo of the group whose tracker holds its issues'
  ),
  template: line('--template <template>', 'development, security or design: brings its steps'),
  position: line('--position <n>', 'Place among the team steps, from 1')
}

const NAME_BY_COMMAND: Record<string, string> = {
  'team create': 'Team name',
  'team update': 'New team name',
  'team step add': 'Step name, shown on the board',
  'team step update': 'New step name',
  'team seat add': 'Seat name (default: the step name and a number)',
  'team seat update': 'New seat name',
  'team role create': 'Role name',
  'team role update': 'New role name'
}

export function formatTeamFlagHelp(command: string, flag: string): string | undefined {
  if (!command.startsWith('team ')) {
    return undefined
  }
  if (flag === 'name' && NAME_BY_COMMAND[command]) {
    return line('--name <text>', NAME_BY_COMMAND[command])
  }
  if (flag === 'agent' && (command === 'team seat pause' || command === 'team seat resume')) {
    return line('--agent <agent>', 'Every active seat that runs this agent CLI')
  }
  if (flag === 'repo' && command === 'team group update') {
    return line('--repo <repoId>', 'Repo of the group that takes part; repeat, replaces the list')
  }
  if (flag === 'title' && command === 'team issue update') {
    return line('--title <text>', 'New issue title')
  }
  return TEAM_FLAG_HELP[flag]
}
