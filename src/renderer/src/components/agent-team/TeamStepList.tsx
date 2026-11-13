import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pause, Play, Plus, Trash2, UserRound } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { getAgentLabel } from '@/lib/agent-catalog/agent-catalog'
import { cn } from '@/lib/class-names'
import type {
  AgentTeam,
  AgentTeamSeat,
  AgentTeamState,
  AgentTeamStep
} from '../../../../shared/agent-team/agent-team-types'
import { teamHasActiveIssues } from '../../../../shared/agent-team/agent-team-mutations'
import { TeamIconButton } from './TeamIconButton'
import type { TeamSeatDialogTarget } from './TeamSeatDialog'
import { stepTypeLabel } from './team-labels'
import { useAgentTeamCommand } from './use-agent-team-state'
import { sortByName } from '../../../../shared/agent-team/agent-team-name-order'

const pointerOptions = { activationConstraint: { distance: 4 } }
const keyboardOptions = { coordinateGetter: sortableKeyboardCoordinates }

function StepNumber({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold">
      {children}
    </span>
  )
}

/** The numbered rail beside each row; the line runs down to the next row. */
function Rail({ marker, line }: { marker: React.ReactNode; line: boolean }): React.JSX.Element {
  return (
    <div className="flex w-6 shrink-0 flex-col items-center">
      {marker}
      {line ? <span className="my-1 w-px flex-1 bg-border" /> : null}
    </div>
  )
}

function SeatChip({
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
    <div className="flex h-8 items-center gap-0.5 rounded-md bg-muted pr-0.5">
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full min-w-0 items-center gap-2 rounded-md pl-2 pr-1 text-left text-xs hover:bg-accent"
      >
        <AgentIcon agent={seat.agent} size={16} />
        <span className={cn('truncate font-medium', paused && 'opacity-60')}>{seat.name}</span>
        <span className={cn('truncate text-muted-foreground', paused && 'opacity-60')}>
          {getAgentLabel(seat.agent)}
          {seat.model ? ` · ${seat.model}` : ''}
          {seat.effort ? ` · ${seat.effort}` : ''}
        </span>
        {paused ? (
          <Badge variant="outline" className="shrink-0">
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

function StepRow({
  team,
  step,
  index,
  state,
  locked,
  onSeatDialog
}: {
  team: AgentTeam
  step: AgentTeamStep
  index: number
  state: AgentTeamState
  locked: boolean
  onSeatDialog: (target: TeamSeatDialogTarget) => void
}): React.JSX.Element {
  const run = useAgentTeamCommand()
  const sortable = useSortable({ id: step.id, disabled: locked })
  const seats = state.seats.filter(
    (seat) => step.seatIds.includes(seat.id) && seat.retiredAt === undefined
  )
  const gripLabel = locked
    ? translate(
        'auto.components.agentTeam.TeamStepList.reorderLocked',
        'Steps cannot be reordered while the team is working on issues.'
      )
    : translate(
        'auto.components.agentTeam.TeamStepList.reorder',
        'Drag to reorder, or press Space and use the arrow keys'
      )
  return (
    <li
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition
      }}
      className={cn('flex gap-3.5', sortable.isDragging && 'relative z-10')}
    >
      <Rail marker={<StepNumber>{index + 1}</StepNumber>} line />
      <div
        className={cn(
          'mb-3 min-w-0 flex-1 rounded-lg border border-border bg-card',
          sortable.isDragging && 'shadow-lg'
        )}
      >
        <div className="flex items-center gap-2 py-2 pl-1.5 pr-2">
          <TeamIconButton
            ref={sortable.setActivatorNodeRef}
            label={gripLabel}
            className="w-5 cursor-grab touch-none active:cursor-grabbing"
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVertical />
          </TeamIconButton>
          <Input
            key={`${step.id}:${step.name}`}
            defaultValue={step.name}
            aria-label={translate(
              'auto.components.agentTeam.TeamSettingsTeams.stepName',
              'Step name'
            )}
            className="h-8 min-w-0 flex-1 border-transparent bg-transparent font-semibold shadow-none hover:border-input focus-visible:border-input dark:bg-transparent"
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
              className="w-52 shrink-0"
              aria-label={translate('auto.components.agentTeam.TeamSettingsTeams.role', 'Role')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortByName(state.roles).map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.name} · {stepTypeLabel(candidate.stepType)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TeamIconButton
            label={translate(
              'auto.components.agentTeam.TeamSettingsTeams.removeStep',
              'Remove step {{name}}',
              { name: step.name }
            )}
            onClick={() => void run({ kind: 'step.remove', teamId: team.id, stepId: step.id })}
          >
            <Trash2 />
          </TeamIconButton>
        </div>
        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          {seats.map((seat) => (
            <SeatChip
              key={seat.id}
              seat={seat}
              onOpen={() => onSeatDialog({ kind: 'edit', seatId: seat.id })}
              onPause={(paused) => void run({ kind: 'seat.pause', seatIds: [seat.id], paused })}
            />
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 border border-dashed border-border text-muted-foreground"
            onClick={() => onSeatDialog({ kind: 'add', teamId: team.id, stepId: step.id })}
          >
            <Plus />
            {translate('auto.components.agentTeam.TeamSettingsTeams.addSeat', 'Add seat')}
          </Button>
        </div>
      </div>
    </li>
  )
}

function AddStepRow({
  team,
  state
}: {
  team: AgentTeam
  state: AgentTeamState
}): React.JSX.Element {
  const run = useAgentTeamCommand()
  const [newStepRole, setNewStepRole] = useState(sortByName(state.roles)[0]?.id ?? '')
  return (
    <li className="flex gap-3.5">
      <Rail
        marker={
          <span className="flex size-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
            <Plus className="size-3" />
          </span>
        }
        line
      />
      <div className="mb-3 flex flex-1 flex-wrap items-center gap-2">
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
            {sortByName(state.roles).map((role) => (
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
          {translate('auto.components.agentTeam.TeamSettingsTeams.addStep', 'Add step')}
        </Button>
      </div>
    </li>
  )
}

/** A team's steps top to bottom, reordered by dragging, ending in Needs you. */
export function TeamStepList({
  team,
  state,
  onSeatDialog
}: {
  team: AgentTeam
  state: AgentTeamState
  onSeatDialog: (target: TeamSeatDialogTarget) => void
}): React.JSX.Element {
  const run = useAgentTeamCommand()
  const sensors = useSensors(
    useSensor(PointerSensor, pointerOptions),
    useSensor(KeyboardSensor, keyboardOptions)
  )
  const locked = teamHasActiveIssues(state, team.id)
  // Holds the dropped order until the store publishes it, so the row does not snap back.
  const [pending, setPending] = useState<{ from: string; ids: string[] } | null>(null)
  const storedIds = team.steps.map((step) => step.id)
  const ids = pending?.from === storedIds.join() ? pending.ids : storedIds
  const steps = ids.flatMap((id) => team.steps.find((step) => step.id === id) ?? [])
  return (
    <ol className="flex flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          const from = ids.indexOf(String(active.id))
          const to = over ? ids.indexOf(String(over.id)) : -1
          if (from === -1 || to === -1 || from === to) {
            return
          }
          setPending({ from: storedIds.join(), ids: arrayMove(ids, from, to) })
          void run({ kind: 'step.move', teamId: team.id, stepId: String(active.id), toIndex: to })
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {steps.map((step, index) => (
            <StepRow
              key={step.id}
              team={team}
              step={step}
              index={index}
              state={state}
              locked={locked}
              onSeatDialog={onSeatDialog}
            />
          ))}
        </SortableContext>
      </DndContext>
      <AddStepRow team={team} state={state} />
      <li className="flex gap-3.5">
        <Rail
          marker={
            <span className="flex size-6 items-center justify-center rounded-full bg-agent-question/15 text-agent-question">
              <UserRound className="size-3.5" />
            </span>
          }
          line={false}
        />
        <div className="flex-1 rounded-lg border border-agent-question/50 bg-agent-question/5 px-3 py-2.5">
          <span className="block text-sm font-semibold">
            {translate('auto.components.agentTeam.TeamSettingsTeams.needsYou', 'Needs you')}
          </span>
          <span className="block text-xs text-muted-foreground">
            {translate(
              'auto.components.agentTeam.TeamSettingsTeams.needsYouHint',
              'You decide: done, request changes or discard.'
            )}
          </span>
        </div>
      </li>
    </ol>
  )
}
