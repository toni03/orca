import { useState } from 'react'
import { GitMerge, GitPullRequest } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { getShortcutPlatform } from '@/lib/shortcut-platform'
import { cn } from '@/lib/utils'
import { openAssignment } from '../../../../shared/agent-team/agent-team-pipeline'
import type { AgentTeamUserDecision } from '../../../../shared/agent-team/agent-team-pipeline'
import type { AgentTeamIssue } from '../../../../shared/agent-team/agent-team-types'
import { openReviewLabel } from './team-labels'

type Props = {
  issue: AgentTeamIssue
  /** Called after a decision is saved, for example to close the surface that shows the form. */
  onDecided?: () => void
  run: (decision: AgentTeamUserDecision) => Promise<boolean>
  textareaRef?: React.Ref<HTMLTextAreaElement>
  /** Opens Orca's review panel for the worktree, where the merge happens. */
  onMerge?: () => void
  className?: string
}

/** What the user can do with an issue that waits for them: answer, review, finish or discard. */
export function TeamDecisionForm({
  issue,
  onDecided,
  run,
  textareaRef,
  onMerge,
  className
}: Props): React.JSX.Element | null {
  // The draft belongs to one issue, so another issue starts empty.
  const [draft, setDraft] = useState<{ issueId: string; note: string } | null>(null)
  const note = draft && draft.issueId === issue.id ? draft.note : ''
  const reason = issue.needsYou?.reason
  if (issue.status !== 'needs-you' || !reason) {
    return null
  }
  // A seat that asked or stopped gets an answer and keeps its step; finished work gets a review.
  const answering = reason === 'blocked' || reason === 'question' || reason === 'failed'
  const sessionOpen = openAssignment(issue) !== undefined

  const decide = async (decision: AgentTeamUserDecision): Promise<void> => {
    if (await run(decision)) {
      setDraft(null)
      onDecided?.()
    }
  }
  const submit = (): void => {
    if (note.trim()) {
      void decide(answering ? { kind: 'answer', note } : { kind: 'request-changes', note })
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {sessionOpen && answering ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamDecisionDialog.sessionStillOpen',
            'The session is still open: your answer is typed into it and it continues. Resume only clears this item.'
          )}
        </p>
      ) : null}
      {answering && issue.needsYou?.options?.length ? (
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={translate(
            'auto.components.agentTeam.TeamDecisionForm.quickAnswers',
            'Quick answers'
          )}
        >
          {issue.needsYou.options.map((option, index) => (
            <Button
              key={option}
              size="sm"
              variant={index === 0 ? 'secondary' : 'outline'}
              onClick={() => void decide({ kind: 'answer', note: option })}
            >
              {option}
            </Button>
          ))}
        </div>
      ) : null}
      <Textarea
        ref={textareaRef}
        rows={2}
        value={note}
        aria-label={
          answering
            ? translate('auto.components.agentTeam.TeamDecisionDialog.answer', 'Your answer')
            : translate('auto.components.agentTeam.TeamDecisionDialog.note', 'Changes to request')
        }
        placeholder={
          answering
            ? translate(
                'auto.components.agentTeam.TeamDecisionForm.answerPlaceholder',
                'Answer the seat…'
              )
            : translate(
                'auto.components.agentTeam.TeamDecisionForm.changesPlaceholder',
                'Changes to request for a new round…'
              )
        }
        onChange={(event) => setDraft({ issueId: issue.id, note: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            submit()
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {answering ? (
          <>
            <Button size="sm" disabled={!note.trim()} onClick={submit}>
              {translate(
                'auto.components.agentTeam.TeamDecisionDialog.sendAnswer',
                'Answer and continue'
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void decide({ kind: 'resume' })}>
              {translate('auto.components.agentTeam.TeamDecisionDialog.resume', 'Resume')}
            </Button>
          </>
        ) : (
          <>
            {reason === 'ready' && onMerge ? (
              <Button size="sm" onClick={onMerge}>
                <GitMerge />
                {translate('auto.components.agentTeam.TeamDecisionForm.merge', 'Merge in Orca')}
              </Button>
            ) : null}
            {reason === 'ready' ? (
              <Button
                size="sm"
                variant={onMerge ? 'outline' : 'default'}
                onClick={() => void decide({ kind: 'done' })}
              >
                {translate('auto.components.agentTeam.TeamDecisionDialog.done', 'Mark done')}
              </Button>
            ) : null}
            {issue.mergeRequest ? (
              <Button size="sm" variant="outline" asChild>
                <a href={issue.mergeRequest.url} target="_blank" rel="noreferrer">
                  <GitPullRequest />
                  {openReviewLabel(issue.mergeRequest.url)}
                </a>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" disabled={!note.trim()} onClick={submit}>
              {translate(
                'auto.components.agentTeam.TeamDecisionDialog.requestChanges',
                'Request changes'
              )}
            </Button>
            {reason === 'ready' ? null : (
              <Button size="sm" variant="ghost" onClick={() => void decide({ kind: 'done' })}>
                {translate('auto.components.agentTeam.TeamDecisionDialog.done', 'Mark done')}
              </Button>
            )}
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => void decide({ kind: 'discard' })}>
          {translate('auto.components.agentTeam.TeamDecisionDialog.discard', 'Discard')}
        </Button>
        <span className="ml-auto text-2xs text-muted-foreground">
          {translate('auto.components.agentTeam.TeamDecisionForm.shortcut', '{{keys}} sends', {
            keys: getShortcutPlatform() === 'darwin' ? '⌘↵' : 'Ctrl+Enter'
          })}
        </span>
      </div>
    </div>
  )
}
