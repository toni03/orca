import { useState } from 'react'
import { Ellipsis, Plus } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { AgentTeam, AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { TeamNewTeamDialog } from './TeamNewTeamDialog'
import { TeamIconButton } from './TeamIconButton'
import { TeamSeatDialog, type TeamSeatDialogTarget } from './TeamSeatDialog'
import { TeamStepList } from './TeamStepList'
import { useAgentTeamCommand } from './use-agent-team-state'

function teamSummary(team: AgentTeam): string {
  return translate(
    'auto.components.agentTeam.TeamSettingsTeams.teamSummary',
    '{{steps}} steps · {{seats}} seats',
    {
      steps: team.steps.length,
      seats: team.steps.reduce((total, step) => total + step.seatIds.length, 0)
    }
  )
}

function TeamPicker({
  state,
  team,
  onSelect
}: {
  state: AgentTeamState
  team: AgentTeam
  onSelect: (teamId: string) => void
}): React.JSX.Element {
  return (
    <Select value={team.id} onValueChange={onSelect}>
      <SelectTrigger
        className="h-9 w-72"
        aria-label={translate('auto.components.agentTeam.TeamSettingsTeams.teams', 'Teams')}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {state.teams.map((candidate) => (
          <SelectItem key={candidate.id} value={candidate.id}>
            <span className="font-semibold">{candidate.name}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {candidate.paused
                ? translate('auto.components.agentTeam.TeamSettingsTeams.pausedBadge', 'Paused')
                : teamSummary(candidate)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function RenameInput({ team, onDone }: { team: AgentTeam; onDone: () => void }): React.JSX.Element {
  const run = useAgentTeamCommand()
  return (
    <Input
      autoFocus
      defaultValue={team.name}
      aria-label={translate('auto.components.agentTeam.TeamSettingsTeams.teamName', 'Team name')}
      className="h-9 w-72"
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          onDone()
        }
      }}
      onBlur={(event) => {
        const name = event.target.value.trim()
        if (name && name !== team.name) {
          void run({ kind: 'team.rename', teamId: team.id, name })
        }
        onDone()
      }}
    />
  )
}

function TeamActions({
  team,
  onRename
}: {
  team: AgentTeam
  onRename: () => void
}): React.JSX.Element {
  const run = useAgentTeamCommand()
  return (
    <>
      <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <Switch
          checked={team.paused === true}
          onCheckedChange={(paused) => void run({ kind: 'team.pause', teamId: team.id, paused })}
        />
        {translate('auto.components.agentTeam.TeamSettingsTeams.pause', 'Paused')}
      </label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TeamIconButton
            size="icon-sm"
            label={translate(
              'auto.components.agentTeam.TeamSettingsTeams.teamActions',
              'Team actions'
            )}
          >
            <Ellipsis />
          </TeamIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onRename}>
            {translate('auto.components.agentTeam.TeamSettingsTeams.renameTeam', 'Rename team')}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => void run({ kind: 'team.delete', teamId: team.id })}
          >
            {translate('auto.components.agentTeam.TeamSettingsTeams.deleteTeam', 'Delete team')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

export function TeamSettingsTeams({ state }: { state: AgentTeamState }): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [seatDialog, setSeatDialog] = useState<TeamSeatDialogTarget | null>(null)
  const team = state.teams.find((candidate) => candidate.id === selectedId) ?? state.teams[0]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        {team && renaming ? (
          <RenameInput team={team} onDone={() => setRenaming(false)} />
        ) : team ? (
          <TeamPicker state={state} team={team} onSelect={setSelectedId} />
        ) : null}
        <Button size="sm" variant="outline" className="h-9" onClick={() => setCreating(true)}>
          <Plus />
          {translate('auto.components.agentTeam.TeamSettingsTeams.newTeam', 'New team')}
        </Button>
        {team ? <TeamActions team={team} onRename={() => setRenaming(true)} /> : null}
      </div>
      {team ? (
        <>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.agentTeam.TeamSettingsTeams.help',
              'A team is a pipeline of steps. Each step has a role (what to do) and seats (who does it). Orca only looks at the step type: Build gets its own worktree and changes code; Check reviews that worktree and passes the issue on or sends it back to the Build step for a new round.'
            )}
          </p>
          <TeamStepList team={team} state={state} onSeatDialog={setSeatDialog} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamSettingsTeams.noTeams',
            'No teams yet. Start from a template with New team.'
          )}
        </p>
      )}
      <TeamNewTeamDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={setSelectedId}
        state={state}
      />
      <TeamSeatDialog target={seatDialog} state={state} onClose={() => setSeatDialog(null)} />
    </div>
  )
}
