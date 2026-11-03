import { useState } from 'react'
import { Lock } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AgentIcon, getAgentCatalog, getAgentLabel } from '@/lib/agent-catalog'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { useAgentTeamCommand } from './use-agent-team-state'

export type TeamSeatDialogTarget =
  | { kind: 'add'; teamId: string; stepId: string }
  | { kind: 'edit'; seatId: string }

type Props = { target: TeamSeatDialogTarget | null; state: AgentTeamState; onClose: () => void }

export function TeamSeatDialog({ target, state, onClose }: Props): React.JSX.Element {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-md">
        {target ? <SeatForm target={target} state={state} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function SeatForm({
  target,
  state,
  onClose
}: { target: TeamSeatDialogTarget } & Omit<Props, 'target'>): React.JSX.Element {
  const run = useAgentTeamCommand()
  const seat =
    target.kind === 'edit'
      ? state.seats.find((candidate) => candidate.id === target.seatId)
      : undefined
  const [name, setName] = useState(seat?.name ?? '')
  const [agent, setAgent] = useState<TuiAgent>(seat?.agent ?? 'claude')
  const [model, setModel] = useState(seat?.model ?? '')
  const [instructions, setInstructions] = useState(seat?.instructions ?? '')

  const save = async (): Promise<void> => {
    const next =
      target.kind === 'add'
        ? await run({
            kind: 'seat.add',
            teamId: target.teamId,
            stepId: target.stepId,
            name,
            agent,
            model
          })
        : await run({
            kind: 'seat.update',
            seatId: target.seatId,
            name,
            model: model.trim() || null,
            instructions
          })
    if (next) {
      onClose()
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {seat
            ? seat.name
            : translate('auto.components.agentTeam.TeamSeatDialog.addTitle', 'Add seat')}
        </DialogTitle>
        <DialogDescription>
          {translate(
            'auto.components.agentTeam.TeamSeatDialog.description',
            'A seat is one agent that takes issues for this step, in any project.'
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-team-seat-name">
          {translate('auto.components.agentTeam.TeamSeatDialog.name', 'Name')}
        </Label>
        <Input
          id="agent-team-seat-name"
          value={name}
          placeholder={translate(
            'auto.components.agentTeam.TeamSeatDialog.namePlaceholder',
            'Dev 1'
          )}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{translate('auto.components.agentTeam.TeamSeatDialog.agent', 'Agent CLI')}</Label>
        {seat ? (
          <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
            <Lock className="size-3.5" />
            <AgentIcon agent={seat.agent} />
            {getAgentLabel(seat.agent)}
          </div>
        ) : (
          <Select
            value={agent}
            onValueChange={(value) => {
              const entry = getAgentCatalog().find((candidate) => candidate.id === value)
              if (entry) {
                setAgent(entry.id)
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getAgentCatalog().map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  <AgentIcon agent={entry.id} />
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamSeatDialog.agentHint',
            'Fixed once the seat exists: correction rounds resume the same kind of session.'
          )}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-team-seat-model">
          {translate('auto.components.agentTeam.TeamSeatDialog.model', 'Model')}
        </Label>
        <Input
          id="agent-team-seat-model"
          value={model}
          placeholder={translate(
            'auto.components.agentTeam.TeamSeatDialog.modelPlaceholder',
            "The agent's default"
          )}
          onChange={(event) => setModel(event.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamSeatDialog.modelHint',
            'Applies from the next session.'
          )}
        </span>
      </div>
      {seat ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agent-team-seat-instructions">
            {translate(
              'auto.components.agentTeam.TeamSeatDialog.instructions',
              'Extra instructions for this seat'
            )}
          </Label>
          <Textarea
            id="agent-team-seat-instructions"
            rows={3}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
        </div>
      ) : null}
      <DialogFooter>
        {seat ? (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto"
            onClick={() =>
              void run({ kind: 'seat.retire', seatId: seat.id }).then((next) => next && onClose())
            }
          >
            {translate('auto.components.agentTeam.TeamSeatDialog.retire', 'Retire seat')}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onClose}>
          {translate('auto.components.agentTeam.TeamSeatDialog.cancel', 'Cancel')}
        </Button>
        <Button type="submit">
          {seat
            ? translate('auto.components.agentTeam.TeamSeatDialog.save', 'Save')
            : translate('auto.components.agentTeam.TeamSeatDialog.add', 'Add seat')}
        </Button>
      </DialogFooter>
    </form>
  )
}
