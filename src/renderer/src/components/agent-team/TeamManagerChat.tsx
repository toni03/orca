import { useEffect, useState } from 'react'
import { ExternalLink, Maximize2, Minimize2, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getAgentLabel } from '@/lib/agent-catalog/agent-catalog'
import { openBotChat } from '@/lib/bot-catalog'
import { structuredAgentSessionTargetForHost } from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { openBotHomePanelFromSidebar } from '@/components/bots/BotRow'
import NativeChatView from '../native-chat/NativeChatView'
import { NativeChatPaneLifetime } from '../native-chat/pane/ownership/native-chat-pane-lifetime'
import { NativeChatHostOutageOwner } from '../native-chat/host-access/native-chat-host-outage-owner'
import { NativeChatComposerEditorOwner } from '../native-chat/composer/editor/native-chat-composer-editor-owner'
import type { Bot } from '../../../../shared/bot-types'
import { selectLocalBotHomeTabs } from '../../../../shared/bots/bot-home-tab'
import { folderWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import { structuredAgentSessionTabId } from '../../../../shared/agent-session/view/structured-agent-session-projection'
import { TeamIconButton } from './TeamIconButton'
import type { ManagerEntry } from './TeamManagerButton'

/** The bot's Home tab when its page has one open, so links and images resolve as they do there. */
function useBotHomeTabId(bot: Bot): string | null {
  return useAppStore((state) => {
    const tabs = state.unifiedTabsByWorktree[folderWorkspaceKey(bot.folderWorkspaceId)]
    return tabs ? (selectLocalBotHomeTabs(tabs, bot)?.home.id ?? null) : null
  })
}

/** The bot's Home chat, opened by the runtime when the bot has none yet. */
function useBotHomeSession(bot: Bot): string | null {
  const [opened, setOpened] = useState<string | null>(null)
  useEffect(() => {
    if (bot.chatSessionId) {
      return
    }
    let cancelled = false
    void openBotChat(bot)
      .then((sessionId) => {
        if (!cancelled) {
          setOpened(sessionId)
        }
      })
      .catch((error: unknown) => console.error('Failed to open the Manager chat:', error))
    return () => {
      cancelled = true
    }
  }, [bot])
  return bot.chatSessionId ?? opened
}

function ManagerChatBody({ bot, focused }: { bot: Bot; focused: boolean }): React.JSX.Element {
  const sessionId = useBotHomeSession(bot)
  const homeTabId = useBotHomeTabId(bot)
  const target = structuredAgentSessionTargetForHost(bot.hostId)
  if (!sessionId || !target) {
    return (
      <p aria-busy="true" className="px-4 py-3 text-xs text-muted-foreground">
        {translate(
          'auto.components.agentTeam.TeamManagerChat.loading',
          'Opening the Manager chat…'
        )}
      </p>
    )
  }
  return (
    <NativeChatPaneLifetime key={`${bot.id}:${sessionId}`} isVisible>
      <NativeChatHostOutageOwner target={target}>
        <NativeChatComposerEditorOwner>
          <NativeChatView
            mode="structured"
            tabId={homeTabId ?? structuredAgentSessionTabId(sessionId)}
            sessionId={sessionId}
            agent={bot.agent}
            isVisible
            isFocusedGroup={focused}
            target={target}
          />
        </NativeChatComposerEditorOwner>
      </NativeChatHostOutageOwner>
    </NativeChatPaneLifetime>
  )
}

/** The Manager bot's chat docked beside the board: the same conversation as on the bot's page. */
export function TeamManagerChat({
  entries,
  expanded,
  onExpandedChange,
  onClose
}: {
  entries: ManagerEntry[]
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onClose: () => void
}): React.JSX.Element | null {
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const entry = entries.find((candidate) => candidate.bot.id === pickedId) ?? entries[0]
  if (!entry) {
    return null
  }
  const { bot } = entry
  return (
    <aside
      className={
        expanded
          ? 'flex min-h-0 min-w-0 flex-1 flex-col'
          : 'flex min-h-0 w-[420px] shrink-0 flex-col border-l border-border'
      }
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false)
        }
      }}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <div className="mr-auto flex min-w-0 flex-col">
          <h2 className="text-sm font-semibold">
            {translate('auto.components.agentTeam.TeamPage.manager', 'Manager')}
          </h2>
          <span className="truncate text-2xs text-muted-foreground">
            {translate('auto.components.agentTeam.TeamManagerChat.scope', '{{bot}} · {{agent}}', {
              bot: bot.name,
              agent: getAgentLabel(bot.agent)
            })}
          </span>
        </div>
        {entries.length > 1 ? (
          <Select value={bot.id} onValueChange={setPickedId}>
            <SelectTrigger
              size="sm"
              className="w-40"
              aria-label={translate(
                'auto.components.agentTeam.TeamManagerChat.pick',
                'Manager to talk to'
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {entries.map((candidate) => (
                <SelectItem key={candidate.bot.id} value={candidate.bot.id}>
                  {candidate.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <TeamIconButton
          variant="ghost"
          size="icon-sm"
          label={translate(
            'auto.components.agentTeam.TeamManagerChat.openBot',
            "Open the Manager's bot page"
          )}
          onClick={() => openBotHomePanelFromSidebar(bot, () => undefined)}
        >
          <ExternalLink />
        </TeamIconButton>
        <TeamIconButton
          variant="ghost"
          size="icon-sm"
          aria-pressed={expanded}
          label={
            expanded
              ? translate(
                  'auto.components.agentTeam.TeamManagerChat.collapse',
                  'Show the board beside the Manager'
                )
              : translate(
                  'auto.components.agentTeam.TeamManagerChat.expand',
                  'Show only the Manager'
                )
          }
          onClick={() => onExpandedChange(!expanded)}
        >
          {expanded ? <Minimize2 /> : <Maximize2 />}
        </TeamIconButton>
        <TeamIconButton
          variant="ghost"
          size="icon-sm"
          label={translate('auto.components.agentTeam.TeamManagerChat.close', 'Hide Manager')}
          onClick={onClose}
        >
          <X />
        </TeamIconButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <ManagerChatBody key={bot.id} bot={bot} focused={focused} />
      </div>
    </aside>
  )
}
