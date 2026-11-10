import { useState } from 'react'
import { ChevronRight, CircleCheck, CircleX, SquareTerminal } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { formatTokens } from '@/components/stats/usage-formatters'
import { TeamIssueDescription } from './TeamIssueDescription'
import { cn } from '@/lib/utils'
import type {
  AgentTeamAssignment,
  AgentTeamFinding,
  AgentTeamIssue,
  AgentTeamState
} from '../../../../shared/agent-team/agent-team-types'
import { formatDuration, issueKey } from './team-labels'
import { AssignmentTokens, assignmentResultLabel } from './TeamAssignmentResult'
import { revealSession, useSessionStatus } from './team-session-pane'

const SEVERITIES: AgentTeamFinding['severity'][] = ['blocker', 'major', 'minor', 'info']

function severityLabel(severity: AgentTeamFinding['severity']): string {
  switch (severity) {
    case 'blocker':
      return translate('auto.components.agentTeam.TeamIssueSheet.blocker', 'Blocker')
    case 'major':
      return translate('auto.components.agentTeam.TeamIssueSheet.major', 'Major')
    case 'minor':
      return translate('auto.components.agentTeam.TeamIssueSheet.minor', 'Minor')
    case 'info':
      return translate('auto.components.agentTeam.TeamIssueSheet.info', 'Info')
  }
}

function stepName(state: AgentTeamState, issue: AgentTeamIssue, stepId: string): string {
  return (
    state.teams.find((team) => team.id === issue.teamId)?.steps.find((step) => step.id === stepId)
      ?.name ?? '—'
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h3 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  )
}

/** Every session that worked on the issue, in order, with totals. */
export function SessionsByRound({
  issue,
  state,
  now
}: {
  issue: AgentTeamIssue
  state: AgentTeamState
  now: number
}): React.JSX.Element | null {
  if (issue.assignments.length === 0) {
    return null
  }
  const seats = new Set(issue.assignments.map((assignment) => assignment.seatId))
  const activeMs = issue.assignments.reduce(
    (total, assignment) => total + (assignment.endedAt ?? now) - assignment.startedAt,
    0
  )
  const tokens = issue.assignments.reduce(
    (total, assignment) =>
      total + (assignment.usage?.status === 'known' ? assignment.usage.totalTokens : 0),
    0
  )
  const cell = 'px-3 py-2'
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <SectionTitle>
          {translate('auto.components.agentTeam.TeamIssueSheet.sessions', 'Sessions by round')}
        </SectionTitle>
        <span className="text-2xs text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamIssueSheet.sessionCount',
            '{{sessions}} sessions · {{seats}} seats',
            { sessions: issue.assignments.length, seats: seats.size }
          )}
        </span>
      </div>
      <div className="overflow-auto rounded-lg border border-border scrollbar-sleek">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-2xs uppercase text-muted-foreground">
            <tr>
              <th className={cn(cell, 'font-medium')}>
                {translate('auto.components.agentTeam.TeamIssueSheet.colRound', 'Step · round')}
              </th>
              <th className={cn(cell, 'font-medium')}>
                {translate('auto.components.agentTeam.TeamActivity.colSeat', 'Seat')}
              </th>
              <th className={cn(cell, 'font-medium')}>
                {translate('auto.components.agentTeam.TeamActivity.colResult', 'Result')}
              </th>
              <th className={cn(cell, 'text-right font-medium')}>
                {translate('auto.components.agentTeam.TeamActivity.colTime', 'Active time')}
              </th>
              <th className={cn(cell, 'text-right font-medium')}>
                {translate('auto.components.agentTeam.TeamActivity.colTokens', 'Tokens')}
              </th>
              <th className={cell} />
            </tr>
          </thead>
          <tbody>
            {issue.assignments.map((assignment) => (
              <SessionRow
                key={assignment.id}
                issue={issue}
                assignment={assignment}
                state={state}
                now={now}
              />
            ))}
            <tr className="border-t border-border font-medium">
              <td className={cell} colSpan={3}>
                {translate('auto.components.agentTeam.TeamIssueSheet.total', 'Total')}
              </td>
              <td className={cn(cell, 'text-right font-mono')}>{formatDuration(activeMs)}</td>
              <td className={cn(cell, 'text-right font-mono')}>
                {tokens > 0 ? formatTokens(tokens) : '—'}
              </td>
              <td className={cell} />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SessionRow({
  issue,
  assignment,
  state,
  now
}: {
  issue: AgentTeamIssue
  assignment: AgentTeamAssignment
  state: AgentTeamState
  now: number
}): React.JSX.Element {
  const seat = state.seats.find((candidate) => candidate.id === assignment.seatId)
  const running = assignment.endedAt === undefined
  const live = useSessionStatus(running ? assignment.terminalHandle : undefined)
  const detail = assignment.result?.summary ?? assignment.stopDetail
  return (
    <tr className="border-t border-border align-top">
      <td className="whitespace-nowrap px-3 py-2">
        {stepName(state, issue, assignment.stepId)} · {assignment.round}
      </td>
      <td className="whitespace-nowrap px-3 py-2">{seat?.name ?? '—'}</td>
      <td className="px-3 py-2">
        <span className="font-medium">{assignmentResultLabel(assignment)}</span>
        {detail ? (
          <span className="line-clamp-2 text-muted-foreground" title={detail}>
            {detail}
          </span>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
        {formatDuration((assignment.endedAt ?? now) - assignment.startedAt)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
        <AssignmentTokens assignment={assignment} />
      </td>
      <td className="px-2 py-1.5 text-right">
        {running && issue.worktreeId ? (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => issue.worktreeId && revealSession(live, issue.worktreeId)}
          >
            <SquareTerminal />
            {translate('auto.components.agentTeam.TeamIssueSheet.goToSession', 'Go to session')}
          </Button>
        ) : null}
      </td>
    </tr>
  )
}

/** Description, acceptance criteria and dependencies in both directions. */
export function IssueDetails({
  issue,
  state
}: {
  issue: AgentTeamIssue
  state: AgentTeamState
}): React.JSX.Element {
  const dependsOn = issue.dependsOn
    .map((id) => state.issues.find((candidate) => candidate.id === id))
    .filter((candidate) => candidate !== undefined)
  const blocks = state.issues.filter((candidate) => candidate.dependsOn.includes(issue.id))
  const lastCheck = issue.assignments
    .toReversed()
    .find(
      (assignment) => assignment.result?.kind === 'pass' || assignment.result?.kind === 'changes'
    )
  const checked = lastCheck?.result?.kind === 'pass' && lastCheck.round === issue.round
  return (
    <div className="flex flex-col gap-4">
      {issue.body.trim() ? (
        <section className="flex flex-col gap-1.5">
          <SectionTitle>
            {translate('auto.components.agentTeam.TeamIssueSheet.description', 'Description')}
          </SectionTitle>
          <TeamIssueDescription issue={issue} />
        </section>
      ) : null}
      {issue.criteria.length > 0 ? (
        <section className="flex flex-col gap-1.5">
          <SectionTitle>
            {translate('auto.components.agentTeam.TeamIssueSheet.criteria', 'Acceptance criteria')}
          </SectionTitle>
          <ul className="flex flex-col gap-1 text-sm">
            {issue.criteria.map((criterion) => (
              <li key={criterion} className="flex items-start gap-2">
                <CircleCheck
                  className={cn(
                    'mt-0.5 size-3.5 shrink-0',
                    checked ? 'text-status-success' : 'text-muted-foreground/50'
                  )}
                />
                {criterion}
              </li>
            ))}
          </ul>
          {checked && lastCheck ? (
            <span className="text-2xs text-muted-foreground">
              {translate(
                'auto.components.agentTeam.TeamIssueSheet.checkedIn',
                'Checked in round {{round}}',
                { round: lastCheck.round }
              )}
            </span>
          ) : null}
        </section>
      ) : null}
      {dependsOn.length > 0 || blocks.length > 0 ? (
        <section className="flex flex-col gap-1.5">
          <SectionTitle>
            {translate('auto.components.agentTeam.TeamIssueSheet.dependencies', 'Dependencies')}
          </SectionTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {dependsOn.length > 0 ? (
              <span>
                <span className="text-muted-foreground">
                  {translate(
                    'auto.components.agentTeam.TeamIssueSheet.dependsOn',
                    'Depends on'
                  )}{' '}
                </span>
                {dependsOn.map((other) => issueKey(other)).join(', ')}
              </span>
            ) : null}
            {blocks.length > 0 ? (
              <span>
                <span className="text-muted-foreground">
                  {translate('auto.components.agentTeam.TeamIssueSheet.blocks', 'Blocks')}{' '}
                </span>
                {blocks.map((other) => issueKey(other)).join(', ')}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function Report({
  issue,
  assignment,
  state
}: {
  issue: AgentTeamIssue
  assignment: AgentTeamAssignment
  state: AgentTeamState
}): React.JSX.Element | null {
  const result = assignment.result
  if (!result) {
    return null
  }
  const findings = 'findings' in result ? (result.findings ?? []) : []
  const questions = result.kind === 'blocked' ? (result.questions ?? []) : []
  const failed = result.kind === 'changes' || result.kind === 'blocked'
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium">
          {translate(
            'auto.components.agentTeam.TeamIssueSheet.reportTitle',
            '{{step}} report · round {{round}}',
            { step: stepName(state, issue, assignment.stepId), round: assignment.round }
          )}
        </span>
        <Badge variant={failed ? 'destructive' : 'outline'}>
          {failed ? <CircleX /> : <CircleCheck className="text-status-success" />}
          {assignmentResultLabel(assignment)}
        </Badge>
      </div>
      {findings.length > 0 ? (
        <span className="text-2xs text-muted-foreground">
          {SEVERITIES.map(
            (severity) =>
              `${findings.filter((finding) => finding.severity === severity).length} ${severityLabel(severity).toLowerCase()}`
          ).join(' · ')}
        </span>
      ) : null}
      <p className="whitespace-pre-wrap text-xs text-muted-foreground">{result.summary}</p>
      {questions.length > 0 ? (
        <ul className="list-disc pl-4 text-xs">
          {questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      ) : null}
      {findings.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-xs">
          {findings.map((finding) => (
            <li
              key={`${finding.severity}:${finding.file ?? ''}:${finding.line ?? ''}:${finding.message}`}
              className="flex flex-col gap-0.5"
            >
              <span>
                <span
                  className={cn(
                    'font-medium',
                    (finding.severity === 'blocker' || finding.severity === 'major') &&
                      'text-destructive'
                  )}
                >
                  {severityLabel(finding.severity)}
                </span>{' '}
                {finding.message}
              </span>
              {finding.file ? (
                <span className="font-mono text-2xs text-muted-foreground">
                  {finding.file}
                  {finding.line ? `:${finding.line}` : ''}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

/** Reports of the latest round open; earlier rounds fold away. */
export function RoundReports({
  issue,
  state
}: {
  issue: AgentTeamIssue
  state: AgentTeamState
}): React.JSX.Element | null {
  const [showEarlier, setShowEarlier] = useState(false)
  const reported = issue.assignments.filter((assignment) => assignment.result !== undefined)
  if (reported.length === 0) {
    return null
  }
  const latestRound = Math.max(...reported.map((assignment) => assignment.round))
  const latest = reported.filter((assignment) => assignment.round === latestRound).toReversed()
  const earlier = reported.filter((assignment) => assignment.round < latestRound).toReversed()
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>
        {translate('auto.components.agentTeam.TeamIssueSheet.reports', 'Reports')}
      </SectionTitle>
      {latest.map((assignment) => (
        <Report key={assignment.id} issue={issue} assignment={assignment} state={state} />
      ))}
      {earlier.length > 0 ? (
        <Collapsible open={showEarlier} onOpenChange={setShowEarlier}>
          <CollapsibleTrigger asChild>
            <Button size="xs" variant="ghost" className="self-start">
              <ChevronRight className={cn('transition-transform', showEarlier && 'rotate-90')} />
              {translate(
                'auto.components.agentTeam.TeamIssueSheet.earlierRounds',
                'Rounds 1–{{last}} reports',
                { last: latestRound - 1 }
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-col gap-2 pt-2">
              {earlier.map((assignment) => (
                <Report key={assignment.id} issue={issue} assignment={assignment} state={state} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  )
}
