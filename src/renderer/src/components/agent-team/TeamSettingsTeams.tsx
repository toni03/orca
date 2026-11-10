import { useState } from 'react'
import { ArrowRight, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { getAgentLabel } from '@/lib/agent-catalog/agent-catalog'
import { cn } from '@/lib/utils'
import type {
  AgentTeam,
  AgentTeamSeat,
  AgentTeamState
} from '../../../../shared/agent-team/agent-team-types'
import { TeamNewTeamDialog } from './TeamNewTeamDialog'
import { TeamIconButton } from './TeamIconButton'
import { TeamSeatDialog, type TeamSeatDialogTarget } from './TeamSeatDialog'
import { stepTypeLabel } from './team-labels'
import { useAgentTeamCommand } from './use-agent-team-state'

function SeatButton({
  seat,
  onOpen,
  onPause
}: {
  seat: AgentTeamSeat
  onOpen: () => void
  onPause: (paused: boolean) => void
}): React.JSX.Element {
  const paused = seat.paused === true
  return (
    <div className="group flex items-center gap-1 rounded-md pr-1 hover:bg-accent">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-xs"
      >
        <AgentIcon agent={seat.agent} size={16} />
        <span className={cn('min-w-0', paused && 'opacity-60')}>
          <span className="block truncate font-medium">{seat.name}</span>
          <span className="block truncate text-muted-foreground">
            {getAgentLabel(seat.agent)}
            {seat.model ? ` · ${seat.model}` : ''}
          </span>
        </span>
        {paused ? (
          <Badge variant="outline" className="ml-auto shrink-0">
            {translate('auto.components.agentTeam.TeamSettingsTeams.pausedBadge', 'Paused')}
          </Badge>
        ) : null}
      </button>
      <TeamIconButton
        label={
          paused
            ? translate('auto.components.agentTeam.TeamSettingsTeams.resumeSeat', 'Resume seat')
            : translate('auto.components.agentTeam.TeamSettingsTeams.pauseSeat', 'Pause seat')
        }
        onClick={() => onPause(!paused)}
      >
        {paused ? <Play /> : <Pause />}
      </TeamIconButton>
    </div>
  )
}

function TeamPipeline({
  team,
  state,
  onSeatDialog
}: {
  team: AgentTeam
  state: AgentTeamState
  onSeatDialog: (target: TeamSeatDialogTarget) => void
}): React.JSX.Element {
  const run = useAgentTeamCommand()
  const [newStepRole, setNewStepRole] = useState(state.roles[0]?.id ?? '')
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-stretch gap-2">
        {team.steps.map((step, index) => {
          const role = state.roles.find((candidate) => candidate.id === step.roleId)
          const seats = state.seats.filter(
            (seat) => step.seatIds.includes(seat.id) && seat.retiredAt === undefined
          )
          return (
            <div key={step.id} className="flex items-stretch gap-2">
              {index > 0 ? <ArrowRight className="self-center text-muted-foreground" /> : null}
              <div className="flex w-56 flex-col rounded-lg border border-border bg-card shadow-xs">
                <div className="flex flex-col gap-1.5 border-b border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {translate('auto.components.agentTeam.TeamSettingsTeams.step', 'Step {{n}}', {
                        n: index + 1
                      })}
                    </span>
                    {role ? (
                      <Badge variant="outline" className="ml-auto">
                        {stepTypeLabel(role.stepType)}
                      </Badge>
                    ) : null}
                    <TeamIconButton
                      size="icon-xs"
                      variant="ghost"
                      label={translate(
                        'auto.components.agentTeam.TeamSettingsTeams.removeStep',
                        'Remove step {{name}}',
                        {
                          name: step.name
                        }
                      )}
                      onClick={() =>
                        void run({ kind: 'step.remove', teamId: team.id, stepId: step.id })
                      }
                    >
                      <Trash2 />
                    </TeamIconButton>
                  </div>
                  <Input
                    key={`${step.id}:${step.name}`}
                    defaultValue={step.name}
                    aria-label={translate(
                      'auto.components.agentTeam.TeamSettingsTeams.stepName',
                      'Step name'
                    )}
                    className="h-7"
                    onBlur={(event) => {
                      if (event.target.value.trim() && event.target.value !== step.name) {
                        void run({
                          kind: 'step.update',
                          teamId: team.id,
                          stepId: step.id,
                          name: event.target.value
                        })
                      }
                    }}
                  />
                  <Select
                    value={step.roleId}
                    onValueChange={(roleId) =>
                      void run({ kind: 'step.update', teamId: team.id, stepId: step.id, roleId })
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-full"
                      aria-label={translate(
                        'auto.components.agentTeam.TeamSettingsTeams.role',
                        'Role'
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {state.roles.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.name} · {stepTypeLabel(candidate.stepType)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-0.5 p-1.5">
                  {seats.map((seat) => (
                    <SeatButton
                      key={seat.id}
                      seat={seat}
                      onOpen={() => onSeatDialog({ kind: 'edit', seatId: seat.id })}
                      onPause={(paused) =>
                        void run({ kind: 'seat.pause', seatIds: [seat.id], paused })
                      }
                    />
                  ))}
                  <Button
                    size="xs"
                    variant="ghost"
                    className="justify-start"
                    onClick={() => onSeatDialog({ kind: 'add', teamId: team.id, stepId: step.id })}
                  >
                    <Plus />
                    {translate('auto.components.agentTeam.TeamSettingsTeams.addSeat', 'Add seat')}
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
        <div className="flex items-stretch gap-2">
          {team.steps.length > 0 ? (
            <ArrowRight className="self-center text-muted-foreground" />
          ) : null}
          <div className="flex w-44 flex-col justify-center rounded-lg border border-agent-question/50 bg-agent-question/5 px-3 py-2 text-xs">
            <span className="font-semibold">
              {translate('auto.components.agentTeam.TeamSettingsTeams.needsYou', 'Needs you')}
            </span>
            <span className="text-muted-foreground">
              {translate(
                'auto.components.agentTeam.TeamSettingsTeams.needsYouHint',
                'You decide: done, request changes or discard.'
              )}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={newStepRole} onValueChange={setNewStepRole}>
          <SelectTrigger
            size="sm"
            className="w-56"
            aria-label={translate(
              'auto.components.agentTeam.TeamSettingsTeams.newStepRole',
              'Role for the new step'
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {state.roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name} · {stepTypeLabel(role.stepType)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={!newStepRole}
          onClick={() => {
            const role = state.roles.find((candidate) => candidate.id === newStepRole)
            void run({
              kind: 'step.add',
              teamId: team.id,
              name: role?.name ?? '',
              roleId: newStepRole
            })
          }}
        >
          <Plus />
          {translate('auto.components.agentTeam.TeamSettingsTeams.addStep', 'Add step')}
        </Button>
      </div>
    </div>
  )
}

export function TeamSettingsTeams({ state }: { state: AgentTeamState }): React.JSX.Element {
  const run = useAgentTeamCommand()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [seatDialog, setSeatDialog] = useState<TeamSeatDialogTarget | null>(null)
  const team = state.teams.find((candidate) => candidate.id === selectedId) ?? state.teams[0]

  return (
    <div className="grid min-h-0 grid-cols-[220px_minmax(0,1fr)] gap-5">
      <section className="flex flex-col gap-1">
        <div className="mb-1 flex items-center">
          <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {translate('auto.components.agentTeam.TeamSettingsTeams.teams', 'Teams')}
          </h2>
          <Button size="xs" variant="outline" className="ml-auto" onClick={() => setCreating(true)}>
            {translate('auto.components.agentTeam.TeamSettingsTeams.newTeam', 'New team')}
          </Button>
        </div>
        {state.teams.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            data-current={candidate.id === team?.id ? 'true' : undefined}
            onClick={() => setSelectedId(candidate.id)}
            className={cn(
              'rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent',
              candidate.id === team?.id && 'bg-accent'
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              {candidate.name}
              {candidate.paused ? (
                <Badge variant="secondary">
                  {translate('auto.components.agentTeam.TeamSettingsTeams.pausedBadge', 'Paused')}
                </Badge>
              ) : null}
            </span>
            <span className="block text-2xs text-muted-foreground">
              {translate(
                'auto.components.agentTeam.TeamSettingsTeams.teamSummary',
                '{{steps}} steps · {{seats}} seats',
                {
                  steps: candidate.steps.length,
                  seats: candidate.steps.reduce((total, step) => total + step.seatIds.length, 0)
                }
              )}
            </span>
          </button>
        ))}
      </section>
      {team ? (
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-2">
            <Input
              key={team.id}
              defaultValue={team.name}
              aria-label={translate(
                'auto.components.agentTeam.TeamSettingsTeams.teamName',
                'Team name'
              )}
              className="h-8 max-w-xs"
              onBlur={(event) => {
                if (event.target.value.trim() && event.target.value !== team.name) {
                  void run({ kind: 'team.rename', teamId: team.id, name: event.target.value })
                }
              }}
            />
            <label className="ml-auto flex items-center gap-2 text-sm">
              <Switch
                checked={team.paused === true}
                onCheckedChange={(paused) =>
                  void run({ kind: 'team.pause', teamId: team.id, paused })
                }
              />
              {translate('auto.components.agentTeam.TeamSettingsTeams.pause', 'Paused')}
            </label>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void run({ kind: 'team.delete', teamId: team.id })}
            >
              {translate('auto.components.agentTeam.TeamSettingsTeams.deleteTeam', 'Delete team')}
            </Button>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {translate(
              'auto.components.agentTeam.TeamSettingsTeams.help',
              'A team is a pipeline of steps. Each step has a role (what to do) and seats (who does it). Orca only looks at the step type: Build gets its own worktree and changes code; Check reviews that worktree and passes the issue on or sends it back to the Build step for a new round.'
            )}
          </p>
          <TeamPipeline team={team} state={state} onSeatDialog={setSeatDialog} />
        </section>
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
