import { useState } from 'react'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AgentIcon } from '@/lib/agent-catalog'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { useEnabledAgents } from './use-enabled-agents'

type Props = { open: boolean; onOpenChange: (open: boolean) => void }

export function TeamManagerDialog(props: Props): React.JSX.Element {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        {props.open ? <ManagerForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ManagerForm({ onOpenChange }: Props): React.JSX.Element {
  const enabled = useEnabledAgents()
  const [picked, setAgent] = useState<TuiAgent | null>(null)
  const agent = enabled.agents.some((entry) => entry.id === picked) ? picked : enabled.preferred
  const [request, setRequest] = useState('')
  const [starting, setStarting] = useState(false)

  const start = async (): Promise<void> => {
    if (!agent) {
      return
    }
    setStarting(true)
    try {
      const launched = await window.api.agentTeam.launchManager({ agent, request })
      onOpenChange(false)
      activateAndRevealWorktree(launched.worktreeId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setStarting(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void start()
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {translate('auto.components.agentTeam.TeamManagerDialog.title', 'Talk to the Manager')}
        </DialogTitle>
        <DialogDescription>
          {translate(
            'auto.components.agentTeam.TeamManagerDialog.description',
            'The Manager is an agent session that drafts issues, registers them in each project tracker following its spec, and adds them to the queue. It shows you a draft before creating anything. It runs in its own Agent Team Manager project, which Orca keeps in ~/.orca/agent-team/manager. If a Manager session with this agent is already open, Orca returns to it and sends your request there.'
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label>{translate('auto.components.agentTeam.TeamManagerDialog.agent', 'Agent CLI')}</Label>
        <Select
          value={agent ?? undefined}
          onValueChange={(value) => {
            const entry = enabled.agents.find((candidate) => candidate.id === value)
            if (entry) {
              setAgent(entry.id)
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {enabled.agents.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                <AgentIcon agent={entry.id} />
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-team-manager-request">
          {translate(
            'auto.components.agentTeam.TeamManagerDialog.request',
            'What do you need? (optional)'
          )}
        </Label>
        <Textarea
          id="agent-team-manager-request"
          rows={4}
          value={request}
          onChange={(event) => setRequest(event.target.value)}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          {translate('auto.components.agentTeam.TeamManagerDialog.cancel', 'Cancel')}
        </Button>
        <Button type="submit" disabled={starting || !agent}>
          {translate('auto.components.agentTeam.TeamManagerDialog.open', 'Open Manager')}
        </Button>
      </DialogFooter>
    </form>
  )
}
