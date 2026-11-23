import { useState } from 'react'
import { Bot as BotIcon, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useBots } from '@/lib/bot-catalog'
import { openBotHomePanelFromSidebar } from '@/components/bots/BotRow'
import { BOT_AGENTS, type Bot } from '../../../../shared/bot-types'
import {
  managerBotIdFor,
  managerScopeOf,
  type AgentTeamManagerScope
} from '../../../../shared/agent-team/agent-team-manager-bots'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { useEnabledAgents } from './use-enabled-agents'

type BotAgent = Bot['agent']

function isBotAgent(value: string): value is BotAgent {
  return BOT_AGENTS.some((agent) => agent === value)
}

function isScope(value: string): value is AgentTeamManagerScope {
  return value === 'shared' || value === 'per-team'
}

/** One Manager row: open its bot, or create it with the agent picked here. */
function ManagerRow({
  label,
  bot,
  teamId,
  agents,
  preferred
}: {
  label: string
  bot: Bot | null
  teamId?: string
  agents: { id: BotAgent; label: string }[]
  preferred: BotAgent | null
}): React.JSX.Element {
  const [agent, setAgent] = useState<BotAgent | null>(preferred)
  const [creating, setCreating] = useState(false)
  const create = async (): Promise<void> => {
    if (!agent) {
      return
    }
    setCreating(true)
    try {
      const made = await window.api.agentTeam.createManagerBot({
        agent,
        ...(teamId ? { teamId } : {})
      })
      openBotHomePanelFromSidebar(made, () => undefined)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setCreating(false)
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2">
      <span className="min-w-32 text-sm font-medium">{label}</span>
      {bot ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => openBotHomePanelFromSidebar(bot, () => undefined)}
        >
          <BotIcon />
          {bot.name}
        </Button>
      ) : (
        <>
          <Select
            value={agent ?? undefined}
            onValueChange={(value) => isBotAgent(value) && setAgent(value)}
          >
            <SelectTrigger size="sm" className="w-40">
              <SelectValue
                placeholder={translate(
                  'auto.components.agentTeam.TeamSettingsManager.agent',
                  'Agent'
                )}
              />
            </SelectTrigger>
            <SelectContent>
              {agents.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!agent || creating} onClick={() => void create()}>
            <Plus />
            {translate(
              'auto.components.agentTeam.TeamSettingsManager.create',
              'Create Manager bot'
            )}
          </Button>
        </>
      )}
    </div>
  )
}

export function TeamSettingsManager({ state }: { state: AgentTeamState }): React.JSX.Element {
  const bots = useBots()
  const { agents: enabled, preferred } = useEnabledAgents()
  const agents = enabled.flatMap((entry) =>
    isBotAgent(entry.id) ? [{ id: entry.id, label: entry.label }] : []
  )
  const preferredAgent = preferred && isBotAgent(preferred) ? preferred : (agents[0]?.id ?? null)
  const scope = managerScopeOf(state)
  const botOf = (teamId: string | null): Bot | null => {
    const id = managerBotIdFor(state, teamId)
    return bots.find((bot) => bot.id === id) ?? null
  }
  const setScope = (value: string): void => {
    if (isScope(value) && value !== scope) {
      void window.api.agentTeam.setManagerScope(value)
    }
  }
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.agentTeam.TeamSettingsManager.help',
          'The Manager is an Orca bot: you talk to it in its chat, and what waits for you shows up as its items, on desktop and phone. It plans and queues the work; seats do the coding.'
        )}
      </p>
      <div className="flex flex-col gap-2">
        <Label>
          {translate('auto.components.agentTeam.TeamSettingsManager.scope', 'Who you talk to')}
        </Label>
        <RadioGroup value={scope} onValueChange={setScope} className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="shared" />
            {translate(
              'auto.components.agentTeam.TeamSettingsManager.shared',
              'One Manager for every team'
            )}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="per-team" />
            {translate(
              'auto.components.agentTeam.TeamSettingsManager.perTeam',
              'One Manager per team'
            )}
          </label>
        </RadioGroup>
      </div>
      {!window.api.agentTeam ? null : scope === 'shared' ? (
        <ManagerRow
          label={translate('auto.components.agentTeam.TeamSettingsManager.allTeams', 'All teams')}
          bot={botOf(null)}
          agents={agents}
          preferred={preferredAgent}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {state.teams.map((team) => (
            <ManagerRow
              key={team.id}
              label={team.name}
              bot={botOf(team.id)}
              teamId={team.id}
              agents={agents}
              preferred={preferredAgent}
            />
          ))}
        </div>
      )}
      {agents.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamSettingsManager.noAgents',
            'No agent that can run a bot is installed and switched on. Turn one on in Settings › Agents.'
          )}
        </p>
      ) : null}
    </div>
  )
}
