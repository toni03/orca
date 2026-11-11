import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { useAgentTeamCommand } from './use-agent-team-state'
import { projectTracker } from '../../../../shared/agent-team/agent-team-project-tracker'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: AgentTeamState
  defaultTeamId: string | undefined
}

export function TeamNewIssueDialog(props: Props): React.JSX.Element {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        {props.open ? <NewIssueForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  )
}

// Mounted per opening so every field starts empty.
function NewIssueForm({ onOpenChange, state, defaultTeamId }: Props): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const teamRepos = repos.filter((repo) => repo.id !== state.managerRepoId)
  const run = useAgentTeamCommand()
  const [repoId, setRepoId] = useState(() => teamRepos[0]?.id ?? '')
  const [teamId, setTeamId] = useState(() => defaultTeamId ?? state.teams[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [criteria, setCriteria] = useState('')
  const [trackerKey, setTrackerKey] = useState('')
  const [exclusive, setExclusive] = useState(false)
  const isFolder = teamRepos.find((repo) => repo.id === repoId)?.kind === 'folder'
  const [approved, setApproved] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const tracker = projectTracker(
    state.projects.find((project) => project.repoId === repoId),
    teamRepos.find((repo) => repo.id === repoId)
  )

  const submit = async (): Promise<void> => {
    setSubmitting(true)
    const ok = await run({
      kind: 'issue.create',
      repoId,
      teamId,
      title,
      body,
      criteria: criteria.split('\n'),
      scope: exclusive || isFolder ? 'exclusive' : 'shared',
      approved,
      ...(tracker && trackerKey.trim()
        ? { tracker: { provider: tracker.provider, key: trackerKey.trim() } }
        : {})
    })
    setSubmitting(false)
    if (ok) {
      onOpenChange(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {translate('auto.components.agentTeam.TeamNewIssueDialog.title', 'New issue')}
        </DialogTitle>
        <DialogDescription>
          {translate(
            'auto.components.agentTeam.TeamNewIssueDialog.description',
            'Approved issues join the priority queue and start when a seat is free.'
          )}
        </DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>
              {translate('auto.components.agentTeam.TeamNewIssueDialog.project', 'Project')}
            </Label>
            <Select value={repoId} onValueChange={setRepoId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {teamRepos.map((repo) => (
                  <SelectItem key={repo.id} value={repo.id}>
                    {repo.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{translate('auto.components.agentTeam.TeamNewIssueDialog.team', 'Team')}</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {state.teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agent-team-issue-title">
            {translate('auto.components.agentTeam.TeamNewIssueDialog.issueTitle', 'Title')}
          </Label>
          <Input
            id="agent-team-issue-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agent-team-issue-body">
            {translate('auto.components.agentTeam.TeamNewIssueDialog.body', 'Description')}
          </Label>
          <Textarea
            id="agent-team-issue-body"
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agent-team-issue-criteria">
            {translate(
              'auto.components.agentTeam.TeamNewIssueDialog.criteria',
              'Acceptance criteria, one per line'
            )}
          </Label>
          <Textarea
            id="agent-team-issue-criteria"
            rows={3}
            value={criteria}
            onChange={(event) => setCriteria(event.target.value)}
          />
        </div>
        {tracker ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-team-issue-key">
              {translate(
                'auto.components.agentTeam.TeamNewIssueDialog.trackerKey',
                'Tracker key (optional)'
              )}
            </Label>
            <Input
              id="agent-team-issue-key"
              value={trackerKey}
              placeholder={translate(
                'auto.components.agentTeam.TeamNewIssueDialog.trackerKeyPlaceholder',
                '#212 or API-128'
              )}
              onChange={(event) => setTrackerKey(event.target.value)}
            />
          </div>
        ) : null}
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            {translate(
              'auto.components.agentTeam.TeamNewIssueDialog.exclusive',
              'Locks the project'
            )}
            <span className="block text-xs text-muted-foreground">
              {isFolder
                ? translate(
                    'auto.components.agentTeam.TeamNewIssueDialog.folderExclusiveHint',
                    'Folder project: every issue locks it, because all steps work in the same folder.'
                  )
                : translate(
                    'auto.components.agentTeam.TeamNewIssueDialog.exclusiveHint',
                    'For refactors or upgrades: no other issue of this project runs beside it.'
                  )}
            </span>
          </span>
          <Switch
            checked={exclusive || isFolder}
            disabled={isFolder}
            onCheckedChange={setExclusive}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          {translate('auto.components.agentTeam.TeamNewIssueDialog.approved', 'Approve now')}
          <Switch checked={approved} onCheckedChange={setApproved} />
        </label>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {translate('auto.components.agentTeam.TeamNewIssueDialog.cancel', 'Cancel')}
          </Button>
          <Button type="submit" disabled={submitting || !title.trim() || !repoId || !teamId}>
            {translate('auto.components.agentTeam.TeamNewIssueDialog.create', 'Add issue')}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
