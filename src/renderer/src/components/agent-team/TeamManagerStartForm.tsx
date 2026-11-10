import { useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
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
import type { AgentTeamManagerSession } from '../../../../shared/agent-team/agent-team-ipc'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import { useEnabledAgents } from './use-enabled-agents'

/** Starts the Manager, or returns to a live session with the same agent. */
export function TeamManagerStartForm({
  onStarted
}: {
  onStarted: (session: AgentTeamManagerSession) => void
}): React.JSX.Element {
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
      onStarted(await window.api.agentTeam.launchManager({ agent, request }))
      setRequest('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setStarting(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-4 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        void start()
      }}
    >
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.agentTeam.TeamManagerStartForm.description',
          'The Manager drafts issues, registers them in each project tracker following its spec and adds them to the queue. It shows you a draft before creating anything. It runs in its own Agent Team Manager project (~/.orca/agent-team/manager).'
        )}
      </p>
      <div className="flex flex-col gap-1.5">
        <Label>
          {translate('auto.components.agentTeam.TeamManagerStartForm.agent', 'Agent CLI')}
        </Label>
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
            'auto.components.agentTeam.TeamManagerStartForm.request',
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
      <Button type="submit" disabled={starting || !agent}>
        {translate('auto.components.agentTeam.TeamManagerStartForm.start', 'Start the Manager')}
      </Button>
    </form>
  )
}
