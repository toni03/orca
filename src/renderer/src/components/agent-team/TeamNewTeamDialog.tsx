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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { BUILTIN_TEAM_TEMPLATES } from '../../../../shared/agent-team/agent-team-builtin-templates'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { useAgentTeamCommand } from './use-agent-team-state'

const EMPTY_TEMPLATE = 'empty'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (teamId: string) => void
  state: AgentTeamState
}

export function TeamNewTeamDialog(props: Props): React.JSX.Element {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md">
        {props.open ? <NewTeamForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function NewTeamForm({ onOpenChange, onCreated, state }: Props): React.JSX.Element {
  const run = useAgentTeamCommand()
  const [templateId, setTemplateId] = useState<string>(
    BUILTIN_TEAM_TEMPLATES[0]?.id ?? EMPTY_TEMPLATE
  )
  const [name, setName] = useState('')
  const template = BUILTIN_TEAM_TEMPLATES.find((candidate) => candidate.id === templateId)
  const roleName = (roleId: string): string =>
    state.roles.find((role) => role.id === roleId)?.name ?? roleId

  const create = async (): Promise<void> => {
    const before = new Set(state.teams.map((team) => team.id))
    const next = await run({
      kind: 'team.create',
      name: name.trim() || template?.name || '',
      ...(template ? { templateId: template.id } : {})
    })
    if (next) {
      const created = next.teams.find((team) => !before.has(team.id))
      if (created) {
        onCreated(created.id)
      }
      onOpenChange(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void create()
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {translate('auto.components.agentTeam.TeamNewTeamDialog.title', 'New team')}
        </DialogTitle>
        <DialogDescription>
          {translate(
            'auto.components.agentTeam.TeamNewTeamDialog.description',
            'Start from a template; you can change every step afterwards. The seats are yours: you pick the CLI and model for each one.'
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-team-new-team-name">
          {translate('auto.components.agentTeam.TeamNewTeamDialog.name', 'Name')}
        </Label>
        <Input
          id="agent-team-new-team-name"
          value={name}
          placeholder={template?.name ?? ''}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </div>
      <RadioGroup value={templateId} onValueChange={setTemplateId}>
        {BUILTIN_TEAM_TEMPLATES.map((candidate) => (
          <label
            key={candidate.id}
            className="flex items-start gap-3 rounded-md border border-border p-3 text-sm"
          >
            <RadioGroupItem value={candidate.id} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">{candidate.name}</span>
              <span className="block text-xs text-muted-foreground">
                {candidate.steps
                  .map((step) => `${step.name} (${roleName(step.roleTemplateId)})`)
                  .join(' → ')}
              </span>
            </span>
          </label>
        ))}
        <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
          <RadioGroupItem value={EMPTY_TEMPLATE} className="mt-0.5" />
          <span>
            <span className="block text-sm font-medium">
              {translate('auto.components.agentTeam.TeamNewTeamDialog.empty', 'Empty team')}
            </span>
            <span className="block text-xs text-muted-foreground">
              {translate(
                'auto.components.agentTeam.TeamNewTeamDialog.emptyHint',
                'Only the Needs you step; add your own'
              )}
            </span>
          </span>
        </label>
      </RadioGroup>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          {translate('auto.components.agentTeam.TeamNewTeamDialog.cancel', 'Cancel')}
        </Button>
        <Button type="submit">
          {translate('auto.components.agentTeam.TeamNewTeamDialog.create', 'Create team')}
        </Button>
      </DialogFooter>
    </form>
  )
}
