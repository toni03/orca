import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { openAssignment } from '../../../../shared/agent-team/agent-team-pipeline'
import type { AgentTeamUserDecision } from '../../../../shared/agent-team/agent-team-pipeline'
import type { AgentTeamIssue, AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { issueKey, needsYouLabel } from './team-labels'
import { useAgentTeamCommand } from './use-agent-team-state'

type Props = { issue: AgentTeamIssue | null; state: AgentTeamState; onClose: () => void }

export function TeamDecisionDialog({ issue, state, onClose }: Props): React.JSX.Element {
  const run = useAgentTeamCommand()
  // The draft belongs to one issue, so opening another starts empty.
  const [draft, setDraft] = useState<{ issueId: string; note: string } | null>(null)
  const note = draft && draft.issueId === issue?.id ? draft.note : ''
  const setNote = (text: string): void => setDraft(issue ? { issueId: issue.id, note: text } : null)
  const live = issue ? (state.issues.find((candidate) => candidate.id === issue.id) ?? issue) : null
  const reason = live?.needsYou?.reason
  const ready = reason === 'ready'
  // A seat that asked or stopped gets an answer and keeps its step; finished work gets a review.
  const answering = reason === 'blocked' || reason === 'question' || reason === 'failed'
  const sessionWaiting = live ? openAssignment(live) !== undefined : false

  const decide = async (decision: AgentTeamUserDecision): Promise<void> => {
    if (live && (await run({ kind: 'issue.decide', issueId: live.id, decision }))) {
      onClose()
    }
  }

  return (
    <Dialog open={live !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-lg">
        {live ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {issueKey(live)} · {live.title}
              </DialogTitle>
              <DialogDescription>
                {live.needsYou ? needsYouLabel(live.needsYou.reason) : null}
              </DialogDescription>
            </DialogHeader>
            {live.needsYou ? (
              <p className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs scrollbar-sleek">
                {live.needsYou.detail}
              </p>
            ) : null}
            {sessionWaiting ? (
              <p className="text-xs text-muted-foreground">
                {translate(
                  'auto.components.agentTeam.TeamDecisionDialog.sessionStillOpen',
                  'The session is still open: your answer is typed into it and it continues. Resume only clears this item.'
                )}
              </p>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-team-decision-note">
                {answering
                  ? translate('auto.components.agentTeam.TeamDecisionDialog.answer', 'Your answer')
                  : translate(
                      'auto.components.agentTeam.TeamDecisionDialog.note',
                      'Changes to request'
                    )}
              </Label>
              <Textarea
                id="agent-team-decision-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => void decide({ kind: 'discard' })}>
                {translate('auto.components.agentTeam.TeamDecisionDialog.discard', 'Discard')}
              </Button>
              {answering ? null : (
                <Button
                  variant="outline"
                  disabled={!note.trim()}
                  onClick={() => void decide({ kind: 'request-changes', note })}
                >
                  {translate(
                    'auto.components.agentTeam.TeamDecisionDialog.requestChanges',
                    'Request changes'
                  )}
                </Button>
              )}
              {answering ? (
                <>
                  <Button variant="outline" onClick={() => void decide({ kind: 'resume' })}>
                    {translate('auto.components.agentTeam.TeamDecisionDialog.resume', 'Resume')}
                  </Button>
                  <Button
                    disabled={!note.trim()}
                    onClick={() => void decide({ kind: 'answer', note })}
                  >
                    {translate(
                      'auto.components.agentTeam.TeamDecisionDialog.sendAnswer',
                      'Answer and continue'
                    )}
                  </Button>
                </>
              ) : ready ? (
                <Button onClick={() => void decide({ kind: 'done' })}>
                  {translate('auto.components.agentTeam.TeamDecisionDialog.done', 'Mark done')}
                </Button>
              ) : (
                <Button onClick={() => void decide({ kind: 'resume' })}>
                  {translate('auto.components.agentTeam.TeamDecisionDialog.resume', 'Resume')}
                </Button>
              )}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
