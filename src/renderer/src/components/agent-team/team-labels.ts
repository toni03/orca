import { translate } from '@/i18n/i18n'
import type { TaskProvider } from '../../../../shared/task-providers'
import type { AgentTeamWaitReason } from '../../../../shared/agent-team/agent-team-scheduler'
import type {
  AgentTeamIssue,
  AgentTeamNeedsYouReason,
  AgentTeamState,
  AgentTeamStepType
} from '../../../../shared/agent-team/agent-team-types'

export function issueKey(issue: AgentTeamIssue): string {
  return issue.tracker?.key ?? issue.id.slice(0, 6)
}

export function trackerLabel(provider: TaskProvider): string {
  switch (provider) {
    case 'github':
      return 'GitHub'
    case 'gitlab':
      return 'GitLab'
    case 'jira':
      return 'Jira'
    case 'linear':
      return 'Linear'
  }
}

/** One line that says where the issue stands, as the sheet header and inbox show it. */
export function issueStatusLabel(issue: AgentTeamIssue, state: AgentTeamState): string {
  const rounds = state.workflow.roundsPerIssue
  switch (issue.status) {
    case 'registered':
      return translate('auto.components.agentTeam.labels.statusRegistered', 'Not approved yet')
    case 'queued':
      return translate('auto.components.agentTeam.labels.statusQueued', 'In the priority queue')
    case 'working': {
      const step = state.teams.find((team) => team.id === issue.teamId)?.steps[issue.stepIndex]
      return translate(
        'auto.components.agentTeam.labels.statusWorking',
        'Working · {{step}} · round {{round}}/{{rounds}}',
        { step: step?.name ?? '—', round: issue.round, rounds }
      )
    }
    case 'needs-you':
      return issue.needsYou?.reason === 'escalated'
        ? translate(
            'auto.components.agentTeam.labels.statusEscalated',
            'Needs you · escalated after {{round}}/{{rounds}} rounds',
            { round: issue.round, rounds }
          )
        : translate('auto.components.agentTeam.labels.statusNeedsYou', 'Needs you · {{reason}}', {
            reason: issue.needsYou ? needsYouLabel(issue.needsYou.reason) : '—'
          })
    case 'done':
      return translate('auto.components.agentTeam.labels.statusDone', 'Done')
    case 'discarded':
      return translate('auto.components.agentTeam.labels.statusDiscarded', 'Discarded')
  }
}

export function stepTypeLabel(stepType: AgentTeamStepType): string {
  return stepType === 'build'
    ? translate('auto.components.agentTeam.labels.build', 'Build')
    : translate('auto.components.agentTeam.labels.check', 'Check')
}

export function needsYouLabel(reason: AgentTeamNeedsYouReason): string {
  switch (reason) {
    case 'ready':
      return translate('auto.components.agentTeam.labels.ready', 'Ready')
    case 'escalated':
      return translate('auto.components.agentTeam.labels.escalated', 'Escalated')
    case 'blocked':
      return translate('auto.components.agentTeam.labels.blocked', 'Blocked')
    case 'question':
      return translate('auto.components.agentTeam.labels.question', 'Waiting for you')
    case 'failed':
      return translate('auto.components.agentTeam.labels.failed', 'Stopped')
  }
}

export function waitReasonLabel(reason: AgentTeamWaitReason, state: AgentTeamState): string {
  const keyOf = (issueId: string): string => {
    const issue = state.issues.find((candidate) => candidate.id === issueId)
    return issue ? issueKey(issue) : issueId.slice(0, 6)
  }
  switch (reason.kind) {
    case 'paused':
      return translate(
        'auto.components.agentTeam.labels.waitPausedAll',
        'Waiting · all teams paused'
      )
    case 'team-paused':
      return translate('auto.components.agentTeam.labels.waitPaused', 'Waiting · team paused')
    case 'dependency':
      return translate(
        'auto.components.agentTeam.labels.waitDependency',
        'Waiting · after {{key}}',
        {
          key: keyOf(reason.issueId)
        }
      )
    case 'project-locked':
      return translate(
        'auto.components.agentTeam.labels.waitLocked',
        'Waiting · project locked by {{key}}',
        { key: keyOf(reason.byIssueId) }
      )
    case 'no-free-seat':
      return translate('auto.components.agentTeam.labels.waitSeat', 'Waiting · no free seat')
    case 'plan-limit':
      return translate(
        'auto.components.agentTeam.labels.waitPlanLimit',
        'Waiting · the seats of this step are out of plan until it resets'
      )
    case 'seats-paused':
      return translate(
        'auto.components.agentTeam.labels.waitSeatsPaused',
        'Waiting · every seat of this step is paused'
      )
    case 'no-seat':
      return translate(
        'auto.components.agentTeam.labels.waitNoSeat',
        'Waiting · this step has no seats'
      )
    case 'missing-team':
      return translate(
        'auto.components.agentTeam.labels.waitTeam',
        'Waiting · its team or step was removed'
      )
  }
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000))
  if (minutes < 60) {
    return translate('auto.components.agentTeam.labels.minutes', '{{count}}m', { count: minutes })
  }
  return translate('auto.components.agentTeam.labels.hours', '{{hours}}h {{minutes}}m', {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60
  })
}

/** GitLab calls a review a merge request; GitHub and the other hosts call it a pull request. */
export function isMergeRequestUrl(url: string): boolean {
  return /\/merge_requests\/\d+/.test(url)
}

export function openReviewLabel(url: string): string {
  return isMergeRequestUrl(url)
    ? translate(
        'auto.components.agentTeam.TeamIssueCard.openMergeRequest',
        'Open the merge request'
      )
    : translate('auto.components.agentTeam.TeamIssueCard.openPullRequest', 'Open the pull request')
}
