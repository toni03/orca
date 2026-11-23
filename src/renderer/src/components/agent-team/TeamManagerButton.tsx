import { Bot as BotIcon, ChevronDown } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useBots } from '@/lib/bot-catalog'
import { openBotHomePanelFromSidebar } from '@/components/bots/BotRow'
import type { Bot } from '../../../../shared/bot-types'
import { activeManagerBots } from '../../../../shared/agent-team/agent-team-manager-bots'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'

type ManagerEntry = { bot: Bot; label: string }

/** The Manager bots in use, labelled by their team when there is one per team. */
function useManagerEntries(state: AgentTeamState | null): ManagerEntry[] {
  const bots = useBots()
  if (!state) {
    return []
  }
  return activeManagerBots(state).flatMap(({ botId, teamIds }) => {
    const bot = bots.find((entry) => entry.id === botId)
    if (!bot) {
      return []
    }
    const team = teamIds.length === 1 ? state.teams.find((entry) => entry.id === teamIds[0]) : null
    return [{ bot, label: team && state.managerScope === 'per-team' ? team.name : bot.name }]
  })
}

function openManager(bot: Bot): void {
  openBotHomePanelFromSidebar(bot, () => undefined)
}

/** Opens the first Manager bot; null when none was set up yet. */
export function useOpenTeamManager(state: AgentTeamState | null): (() => void) | undefined {
  const [first] = useManagerEntries(state)
  return first ? () => openManager(first.bot) : undefined
}

export function TeamManagerButton({
  state,
  onOpenSettings
}: {
  state: AgentTeamState
  onOpenSettings: () => void
}): React.JSX.Element {
  const entries = useManagerEntries(state)
  const label = translate('auto.components.agentTeam.TeamPage.manager', 'Manager')
  if (entries.length === 0) {
    return (
      <Button size="sm" variant="outline" onClick={onOpenSettings}>
        <BotIcon />
        {translate('auto.components.agentTeam.TeamManagerButton.setUp', 'Set up the Manager')}
      </Button>
    )
  }
  if (entries.length === 1) {
    return (
      <Button size="sm" onClick={() => openManager(entries[0]!.bot)}>
        <BotIcon />
        {label}
      </Button>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <BotIcon />
          {label}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {entries.map((entry) => (
          <DropdownMenuItem key={entry.bot.id} onSelect={() => openManager(entry.bot)}>
            {entry.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
