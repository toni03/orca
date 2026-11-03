import { Users } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { useAgentTeamState } from './use-agent-team-state'

export function TeamSidebarButton(): React.JSX.Element {
  const { state } = useAgentTeamState()
  const openTeamPage = useAppStore((s) => s.openTeamPage)
  const active = useAppStore((s) => s.activeView === 'team')
  const working = state?.issues.filter((issue) => issue.status === 'working').length ?? 0
  const needsYou = state?.issues.filter((issue) => issue.status === 'needs-you').length ?? 0

  return (
    <button
      type="button"
      onClick={openTeamPage}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
        active
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
          : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
      )}
    >
      <Users
        className={cn('size-4 shrink-0', !active && 'text-worktree-sidebar-foreground/30')}
        strokeWidth={active ? 2.25 : 1.75}
      />
      <span className="flex-1">
        {translate('auto.components.agentTeam.TeamSidebarButton.label', 'Team')}
      </span>
      {needsYou > 0 ? (
        <span className="rounded-full border border-agent-question/45 bg-agent-question/10 px-1.5 text-2xs font-semibold text-agent-question-text">
          {needsYou}
        </span>
      ) : working > 0 ? (
        <span className="text-2xs text-worktree-sidebar-foreground/50">
          {translate('auto.components.agentTeam.TeamSidebarButton.working', '{{count}} working', {
            count: working
          })}
        </span>
      ) : null}
    </button>
  )
}
