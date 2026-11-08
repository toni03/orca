import type { TuiAgent } from '../agent-launch/catalog/tui-agent'
import type { TaskProvider } from '../task-providers'

/** Orca routes by step type only; role names and prompts belong to the user. */
export type AgentTeamStepType = 'build' | 'check'

export type AgentTeamTemplateOrigin = 'builtin' | 'organization' | 'local'

export type AgentTeamRole = {
  id: string
  name: string
  stepType: AgentTeamStepType
  prompt: string
  skills: string[]
  /** Bumped on every prompt edit; sessions record the version they used. */
  version: number
  origin: AgentTeamTemplateOrigin
  /** Template this role was copied from, so it can be reset or updated. */
  templateId?: string
  templateVersion?: number
  updatedAt: number
}

export type AgentTeamStep = {
  id: string
  name: string
  roleId: string
  seatIds: string[]
}

export type AgentTeam = {
  id: string
  name: string
  /** Build and Check steps in order; Needs you always follows the last one. */
  steps: AgentTeamStep[]
  templateId?: string
  /** A paused team takes no new steps; running sessions finish. */
  paused?: boolean
  createdAt: number
}

export type AgentTeamSeat = {
  id: string
  name: string
  /** Fixed once the seat exists: correction rounds resume the same CLI. */
  agent: TuiAgent
  model?: string
  instructions: string
  /** A paused seat takes no new steps, for example while its agent is out of credits. */
  paused?: boolean
  createdAt: number
  retiredAt?: number
}

export type AgentTeamTrackerRef = {
  provider: TaskProvider
  /** Provider key as shown to people: `#212`, `API-128`, `ENG-42`. */
  key: string
  url?: string
}

export type AgentTeamProjectSpecStorage = 'repository' | 'local'

export type AgentTeamProject = {
  repoId: string
  tracker?: { provider: TaskProvider; projectKey?: string }
  specStorage: AgentTeamProjectSpecStorage
  /** Only used when `specStorage` is `local`; repository specs live in the repo file. */
  localSpec?: string
  specTemplateId?: string
  /** Branch new worktrees start from and merge requests target; absent uses the repo default. */
  baseBranch?: string
}

export type AgentTeamIssueStatus =
  | 'registered'
  | 'queued'
  | 'working'
  | 'needs-you'
  | 'done'
  | 'discarded'

export type AgentTeamNeedsYouReason = 'ready' | 'escalated' | 'blocked' | 'question' | 'failed'

/** Whether the issue may share its project with other active issues. */
export type AgentTeamIssueScope = 'shared' | 'exclusive'

export type AgentTeamFinding = {
  severity: 'blocker' | 'major' | 'minor' | 'info'
  message: string
  file?: string
  line?: number
}

export type AgentTeamStepResult =
  | { kind: 'done'; summary: string; mergeRequestUrl?: string }
  | {
      kind: 'blocked'
      summary: string
      questions?: string[]
      /** Short answers the user can pick with one click, e.g. Allow / Deny. */
      options?: string[]
    }
  | { kind: 'pass'; summary: string; findings?: AgentTeamFinding[] }
  | { kind: 'changes'; summary: string; findings: AgentTeamFinding[] }

/** Tokens a session used, read from the agent's local transcripts after it ends. */
export type AgentTeamAssignmentUsage =
  | {
      status: 'known'
      inputTokens: number
      outputTokens: number
      cacheReadTokens: number
      totalTokens: number
    }
  | { status: 'unavailable'; reason: string }

export type AgentTeamAssignment = {
  id: string
  seatId: string
  stepId: string
  round: number
  roleVersion: number
  terminalHandle?: string
  startedAt: number
  endedAt?: number
  result?: AgentTeamStepResult
  /** Set when the session stopped without reporting. */
  stopReason?: 'exited' | 'needs-input' | 'errored' | 'launch-failed' | 'cancelled'
  stopDetail?: string
  usage?: AgentTeamAssignmentUsage
}

export type AgentTeamIssue = {
  id: string
  repoId: string
  teamId: string
  title: string
  body: string
  criteria: string[]
  tracker?: AgentTeamTrackerRef
  status: AgentTeamIssueStatus
  /** Lower runs first; the Manager orders it and the user can override. */
  priority: number
  scope: AgentTeamIssueScope
  dependsOn: string[]
  stepIndex: number
  round: number
  worktreeId?: string
  branch?: string
  assignments: AgentTeamAssignment[]
  needsYou?: {
    reason: AgentTeamNeedsYouReason
    detail: string
    at: number
    /** Quick answers the seat offered; picking one answers with its text. */
    options?: string[]
  }
  /** Merge or pull request the Build step opened for review. */
  mergeRequest?: { url: string }
  createdAt: number
  updatedAt: number
}

export type AgentTeamWorkflow = {
  roundsPerIssue: number
  /** The Manager proposes the next batch when fewer queued issues remain. */
  batchThreshold: number
  paused: boolean
  /** Absent means on: the Manager updates tracker labels as issues move. */
  syncTracker?: boolean
}

/** A move the Manager still has to reflect in the tracker. */
export type AgentTeamTrackerEvent = {
  id: string
  issueId: string
  repoId: string
  key: string
  title: string
  position: string
  at: number
}

/** An agent CLI ran out of its plan window; its seats took no new steps until it reset. */
export type AgentTeamLimitPause = {
  agent: TuiAgent
  startedAt: number
  endedAt?: number
  /** When the provider said the window resets, if it did. */
  resetsAt?: number
}

export type AgentTeamState = {
  version: 1
  roles: AgentTeamRole[]
  teams: AgentTeam[]
  seats: AgentTeamSeat[]
  projects: AgentTeamProject[]
  issues: AgentTeamIssue[]
  workflow: AgentTeamWorkflow
  /** Optional so states saved before tracker sync still load. */
  trackerEvents?: AgentTeamTrackerEvent[]
  /** Spans when an agent CLI hit its plan limit, so its seats waited; the latest are kept. */
  limitPauses?: AgentTeamLimitPause[]
  /** When the Manager last received the tracker moves, so the board can say how fresh trackers are. */
  trackerSyncedAt?: number
  /** The Manager's own folder project, kept out of team project lists. */
  managerRepoId?: string
}
