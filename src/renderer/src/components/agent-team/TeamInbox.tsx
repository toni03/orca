import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleHelp, CircleX, GitMerge } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  openAssignment,
  type AgentTeamUserDecision
} from '../../../../shared/agent-team/agent-team-pipeline'
import type {
  AgentTeamIssue,
  AgentTeamNeedsYouReason,
  AgentTeamState
} from '../../../../shared/agent-team/agent-team-types'
import { TeamDecisionForm } from './TeamDecisionForm'
import { TeamIssueSheet } from './TeamIssueSheet'
import { TeamProjectAvatar } from './TeamProjectAvatar'
import { formatDuration, issueKey, needsYouLabel, trackerLabel } from './team-labels'
import { useAgentTeamCommand } from './use-agent-team-state'
import { useNow } from './use-now'

type InboxTab = 'all' | 'questions' | 'decisions' | 'escalated' | 'ready'
const ALL_PROJECTS = 'all'

const TAB_REASONS: Record<Exclude<InboxTab, 'all'>, AgentTeamNeedsYouReason[]> = {
  questions: ['question'],
  decisions: ['blocked', 'failed'],
  escalated: ['escalated'],
  ready: ['ready']
}

function isInboxTab(value: string): value is InboxTab {
  return value === 'all' || value in TAB_REASONS
}

function tabLabel(tab: InboxTab): string {
  switch (tab) {
    case 'all':
      return translate('auto.components.agentTeam.TeamInbox.all', 'All')
    case 'questions':
      return translate('auto.components.agentTeam.TeamInbox.questions', 'Questions')
    case 'decisions':
      return translate('auto.components.agentTeam.TeamInbox.decisions', 'Decisions')
    case 'escalated':
      return translate('auto.components.agentTeam.TeamInbox.escalated', 'Escalated')
    case 'ready':
      return translate('auto.components.agentTeam.TeamInbox.ready', 'Ready')
  }
}

function ReasonIcon({ reason }: { reason: AgentTeamNeedsYouReason }): React.JSX.Element {
  const className = 'size-4'
  switch (reason) {
    case 'question':
      return <CircleHelp className={className} />
    case 'ready':
      return <GitMerge className={className} />
    case 'failed':
      return <CircleX className={className} />
    case 'blocked':
    case 'escalated':
      return <CircleAlert className={className} />
  }
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

/** Everything that waits for the user across every project, answerable in place. */
export function TeamInbox({
  state,
  active
}: {
  state: AgentTeamState
  active: boolean
}): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const run = useAgentTeamCommand()
  const now = useNow(30_000)
  const [tab, setTab] = useState<InboxTab>('all')
  const [project, setProject] = useState(ALL_PROJECTS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const replyRef = useRef<HTMLTextAreaElement>(null)

  const waiting = useMemo(
    () =>
      state.issues
        .filter((issue) => issue.status === 'needs-you' && issue.needsYou)
        .sort((a, b) => (b.needsYou?.at ?? 0) - (a.needsYou?.at ?? 0)),
    [state.issues]
  )
  const inProject = waiting.filter((issue) => project === ALL_PROJECTS || issue.repoId === project)
  const items = inProject.filter(
    (issue) => tab === 'all' || (issue.needsYou && TAB_REASONS[tab].includes(issue.needsYou.reason))
  )
  const selected = items.find((issue) => issue.id === selectedId) ?? items[0]
  const projectIds = [...new Set(waiting.map((issue) => issue.repoId))]

  useEffect(() => {
    if (!active) {
      return
    }
    const onKey = (event: KeyboardEvent): void => {
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) {
        return
      }
      const index = selected ? items.indexOf(selected) : -1
      if (event.key === 'j' || event.key === 'k') {
        const next = items[index + (event.key === 'j' ? 1 : -1)]
        if (next) {
          event.preventDefault()
          setSelectedId(next.id)
        }
      } else if (event.key === 'Enter' && selected) {
        event.preventDefault()
        setSheetId(selected.id)
      } else if (event.key === 'r' && selected) {
        event.preventDefault()
        replyRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, items, selected])

  const decide =
    (issue: AgentTeamIssue) =>
    async (decision: AgentTeamUserDecision): Promise<boolean> =>
      (await run({ kind: 'issue.decide', issueId: issue.id, decision })) !== null

  return (
    <div className="flex max-w-4xl flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">
          {translate('auto.components.agentTeam.TeamPage.tabNeedsYou', 'Needs you')}
        </h2>
        <span className="text-xs text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamInbox.from',
            '{{count}} from {{projects}} projects',
            {
              count: waiting.length,
              projects: projectIds.length
            }
          )}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(value) => isInboxTab(value) && setTab(value)}>
          <TabsList size="sm">
            {(['all', 'questions', 'decisions', 'escalated', 'ready'] as const).map((candidate) => (
              <TabsTrigger key={candidate} value={candidate}>
                {tabLabel(candidate)}
                <span className="text-muted-foreground">
                  {candidate === 'all'
                    ? inProject.length
                    : inProject.filter(
                        (issue) =>
                          issue.needsYou && TAB_REASONS[candidate].includes(issue.needsYou.reason)
                      ).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {projectIds.length > 1 ? (
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger
              size="sm"
              className="ml-auto min-w-40"
              aria-label={translate('auto.components.agentTeam.TeamInbox.project', 'Project')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROJECTS}>
                {translate('auto.components.agentTeam.TeamInbox.allProjects', 'All projects')}
              </SelectItem>
              {projectIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {repos.find((repo) => repo.id === id)?.displayName ?? id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {translate('auto.components.agentTeam.TeamInbox.empty', 'Nothing waits for you here.')}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border/60">
          {items.map((issue) => {
            const reason = issue.needsYou?.reason ?? 'blocked'
            const repo = repos.find((candidate) => candidate.id === issue.repoId)
            const name = repo?.displayName ?? issue.repoId
            const seat = state.seats.find(
              (candidate) =>
                candidate.id === (openAssignment(issue) ?? issue.assignments.at(-1))?.seatId
            )
            const isSelected = selected?.id === issue.id
            return (
              <li
                key={issue.id}
                className={cn(
                  'grid grid-cols-[1.75rem_1fr_auto] gap-3 border-t border-border/60 px-4 py-3 first:border-t-0',
                  isSelected && 'bg-accent'
                )}
                onFocusCapture={() => setSelectedId(issue.id)}
              >
                <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <ReasonIcon reason={reason} />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <TeamProjectAvatar repo={repo} name={name} />
                    <span className="font-medium text-foreground">{name}</span>
                    <span className="font-mono">{issueKey(issue)}</span>
                    <span>
                      ·{' '}
                      {[
                        issue.tracker ? trackerLabel(issue.tracker.provider) : null,
                        needsYouLabel(reason),
                        seat?.name
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-left text-sm font-medium hover:underline"
                    onClick={() => setSheetId(issue.id)}
                  >
                    {issue.title}
                  </button>
                  <p
                    className={cn(
                      'whitespace-pre-wrap text-xs text-muted-foreground',
                      !isSelected && 'line-clamp-2'
                    )}
                  >
                    {issue.needsYou?.detail}
                  </p>
                  {isSelected ? (
                    <TeamDecisionForm
                      issue={issue}
                      run={decide(issue)}
                      textareaRef={replyRef}
                      className="mt-1"
                    />
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {issue.needsYou?.options?.map((option, index) => (
                        <Button
                          key={option}
                          size="xs"
                          variant={index === 0 ? 'secondary' : 'outline'}
                          onClick={() => void decide(issue)({ kind: 'answer', note: option })}
                        >
                          {option}
                        </Button>
                      ))}
                      <Button
                        size="xs"
                        variant={issue.needsYou?.options?.length ? 'ghost' : 'secondary'}
                        onClick={() => setSelectedId(issue.id)}
                      >
                        {reason === 'question' || reason === 'blocked' || reason === 'failed'
                          ? translate('auto.components.agentTeam.TeamInbox.reply', 'Reply')
                          : translate('auto.components.agentTeam.TeamIssueCard.review', 'Review')}
                      </Button>
                    </div>
                  )}
                </div>
                <span className="text-2xs text-muted-foreground">
                  {issue.needsYou ? formatDuration(now - issue.needsYou.at) : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex gap-4 text-2xs text-muted-foreground">
        <span>
          <kbd className="rounded bg-muted px-1">J</kbd>{' '}
          <kbd className="rounded bg-muted px-1">K</kbd>{' '}
          {translate('auto.components.agentTeam.TeamInbox.keysMove', 'move')}
        </span>
        <span>
          <kbd className="rounded bg-muted px-1">
            {translate('auto.components.agentTeam.TeamInbox.keyEnter', 'Enter')}
          </kbd>{' '}
          {translate('auto.components.agentTeam.TeamInbox.keysOpen', 'open issue')}
        </span>
        <span>
          <kbd className="rounded bg-muted px-1">R</kbd>{' '}
          {translate('auto.components.agentTeam.TeamInbox.keysReply', 'reply')}
        </span>
      </div>
      <TeamIssueSheet issueId={sheetId} state={state} onClose={() => setSheetId(null)} />
    </div>
  )
}
