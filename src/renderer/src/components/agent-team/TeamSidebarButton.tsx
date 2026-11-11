import { Inbox, Users } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import type { TeamPageTab } from '@/store/slices/ui/ui-slice-contract-core'
import { useAgentTeamState } from './use-agent-team-state'
import { useNeedsYouToasts } from './use-needs-you-toasts'

function SidebarEntry({
  active,
  icon: Icon,
  label,
  onClick,
  children
}: {
  active: boolean
  icon: typeof Users
  label: string
  onClick: () => void
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
        active
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
          : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
      )}
    >
      <Icon
        className={cn('size-4 shrink-0', !active && 'text-worktree-sidebar-foreground/30')}
        strokeWidth={active ? 2.25 : 1.75}
      />
      <span className="flex-1">{label}</span>
      {children}
    </button>
  )
}

/** Team and, while anything waits for the user, a Needs you entry; hidden entries still raise Needs you toasts. */
export function TeamSidebarButton({ visible }: { visible: boolean }): React.JSX.Element | null {
  const { state } = useAgentTeamState()
  useNeedsYouToasts(state)
  const openTeamPage = useAppStore((s) => s.openTeamPage)
  const onTeamPage = useAppStore((s) => s.activeView === 'team')
  const tab = useAppStore((s) => s.teamPageTab)
  const working = state?.issues.filter((issue) => issue.status === 'working').length ?? 0
  const needsYou = state?.issues.filter((issue) => issue.status === 'needs-you').length ?? 0
  const open = (next: TeamPageTab) => () => openTeamPage(next)
  if (!visible) {
    return null
  }

  return (
    <>
      <SidebarEntry
        active={onTeamPage && tab !== 'needs-you'}
        icon={Users}
        label={translate('auto.components.agentTeam.TeamSidebarButton.label', 'Team')}
        onClick={open(tab === 'needs-you' ? 'board' : tab)}
      >
        {working > 0 ? (
          <span className="text-2xs text-worktree-sidebar-foreground/50">
            {translate('auto.components.agentTeam.TeamSidebarButton.working', '{{count}} working', {
              count: working
            })}
          </span>
        ) : null}
      </SidebarEntry>
      {needsYou > 0 || (onTeamPage && tab === 'needs-you') ? (
        <SidebarEntry
          active={onTeamPage && tab === 'needs-you'}
          icon={Inbox}
          label={translate('auto.components.agentTeam.TeamPage.tabNeedsYou', 'Needs you')}
          onClick={open('needs-you')}
        >
          {needsYou > 0 ? (
            <span className="rounded-full border border-agent-question/45 bg-agent-question/10 px-1.5 text-2xs font-semibold text-agent-question-text">
              {needsYou}
            </span>
          ) : null}
        </SidebarEntry>
      ) : null}
    </>
  )
}
