import { Bot as BotIcon, MessagesSquare } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { useBots } from '@/lib/bot-catalog'
import type { Bot } from '../../../../shared/bot-types'
import { activeManagerBots } from '../../../../shared/agent-team/agent-team-manager-bots'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'

export type ManagerEntry = { bot: Bot; label: string }

/** The Manager bots in use, labelled by their team when there is one per team. */
export function useManagerEntries(state: AgentTeamState | null): ManagerEntry[] {
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

/** Shows or hides the Manager chat; sends to Settings › Team when no Manager was set up yet. */
export function TeamManagerButton({
  hasManager,
  open,
  onToggle,
  onOpenSettings
}: {
  hasManager: boolean
  open: boolean
  onToggle: () => void
  onOpenSettings: () => void
}): React.JSX.Element {
  if (!hasManager) {
    return (
      <Button size="sm" variant="outline" onClick={onOpenSettings}>
        <BotIcon />
        {translate('auto.components.agentTeam.TeamManagerButton.setUp', 'Set up the Manager')}
      </Button>
    )
  }
  return (
    <Button
      size="sm"
      variant={open ? 'secondary' : 'default'}
      aria-pressed={open}
      onClick={onToggle}
    >
      <MessagesSquare />
      {translate('auto.components.agentTeam.TeamPage.manager', 'Manager')}
    </Button>
  )
}
