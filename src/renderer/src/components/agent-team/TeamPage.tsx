import { MessagesSquare, Pause, Play, Settings, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTokens } from '@/components/stats/usage-formatters'
import type { TeamPageTab } from '@/store/slices/ui/ui-slice-contract-core'
import {
  activityTotals,
  lastDaysRange,
  seatStatus
} from '../../../../shared/agent-team/agent-team-activity-stats'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { TeamBoard } from './TeamBoard'
import { TeamIconButton } from './TeamIconButton'
import { TeamActivity } from './TeamActivity'
import { TeamInbox } from './TeamInbox'
import { TeamManagerPanel } from './TeamManagerPanel'
import { useTeamManagerView } from './team-manager-view'
import { formatDuration } from './team-labels'
import { useAgentTeamCommand, useAgentTeamState } from './use-agent-team-state'
import { useNow } from './use-now'

function isTeamTab(value: string): value is TeamPageTab {
  return value === 'board' || value === 'activity' || value === 'needs-you'
}

function TeamSummary({ state }: { state: AgentTeamState }): React.JSX.Element {
  const seats = state.seats.filter((seat) => seat.retiredAt === undefined)
  const working = seats.filter((seat) => seatStatus(state, seat).kind === 'working').length
  const needsYou = state.issues.filter((issue) => issue.status === 'needs-you').length
  const projects = new Set(
    state.issues
      .filter((issue) => issue.status !== 'done' && issue.status !== 'discarded')
      .map((issue) => issue.repoId)
  ).size
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {working > 0 ? <span className="size-1.5 rounded-full bg-agent-working" /> : null}
      {translate(
        'auto.components.agentTeam.TeamPage.summary',
        '{{seats}} seats · {{working}} working · {{projects}} projects',
        { seats: seats.length, working, projects }
      )}
      {needsYou > 0 ? (
        <span className="font-medium text-agent-question-text">
          {translate('auto.components.agentTeam.TeamPage.needYou', '· {{count}} need you', {
            count: needsYou
          })}
        </span>
      ) : null}
    </span>
  )
}

export default function TeamPage(): React.JSX.Element {
  const { state, loadError } = useAgentTeamState()
  const run = useAgentTeamCommand()
  const closeTeamPage = useAppStore((s) => s.closeTeamPage)
  // Settings moved to Settings › Team; an older 'settings' tab opens the board.
  const storedTab = useAppStore((s) => s.teamPageTab)
  const tab = storedTab === 'settings' ? 'board' : storedTab
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const openTeamSettings = (): void => {
    openSettingsTarget({ pane: 'team', repoId: null })
    openSettingsPage()
  }
  const setTab = useAppStore((s) => s.setTeamPageTab)
  const [managerView, setManagerView] = useTeamManagerView()
  const managerOpen = managerView !== 'closed'
  const now = useNow(60_000)
  const today = state ? activityTotals(state, lastDaysRange(1, now), now) : null
  const needsYou = state?.issues.filter((issue) => issue.status === 'needs-you').length ?? 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <h1 className="text-lg font-semibold">
          {translate('auto.components.agentTeam.TeamPage.title', 'Team')}
        </h1>
        {state ? <TeamSummary state={state} /> : null}
        <span className="ml-auto flex items-center gap-2">
          {state ? (
            <Button
              size="sm"
              variant="outline"
              aria-pressed={state.workflow.paused}
              onClick={() =>
                void run({ kind: 'workflow.update', patch: { paused: !state.workflow.paused } })
              }
            >
              {state.workflow.paused ? <Play /> : <Pause />}
              {state.workflow.paused
                ? translate('auto.components.agentTeam.TeamPage.resumeTeam', 'Resume team')
                : translate('auto.components.agentTeam.TeamPage.pauseTeam', 'Pause team')}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={managerOpen ? 'secondary' : 'default'}
            aria-pressed={managerOpen}
            onClick={() => setManagerView(managerOpen ? 'closed' : 'docked')}
          >
            <MessagesSquare />
            {translate('auto.components.agentTeam.TeamPage.manager', 'Manager')}
          </Button>
          <TeamIconButton
            variant="ghost"
            size="icon-sm"
            label={translate('auto.components.agentTeam.TeamPage.openSettings', 'Team settings')}
            onClick={openTeamSettings}
          >
            <Settings />
          </TeamIconButton>
          <TeamIconButton
            variant="ghost"
            size="icon-sm"
            label={translate('auto.components.agentTeam.TeamPage.close', 'Close Team')}
            onClick={closeTeamPage}
          >
            <X />
          </TeamIconButton>
        </span>
      </div>
      {loadError ? (
        <p className="px-5 py-4 text-sm text-destructive">
          {translate(
            'auto.components.agentTeam.TeamPage.loadError',
            'Agent teams are not available in this window: {{message}}',
            { message: loadError }
          )}
        </p>
      ) : !state ? (
        <p aria-busy="true" className="px-5 py-4 text-sm text-muted-foreground">
          {translate('auto.components.agentTeam.TeamPage.loading', 'Loading the team…')}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1">
          <Tabs
            value={tab}
            onValueChange={(value) => {
              if (isTeamTab(value)) {
                setTab(value)
              }
            }}
            className={
              managerView === 'expanded' ? 'hidden' : 'flex min-h-0 min-w-0 flex-1 flex-col'
            }
          >
            <div className="mx-5 mt-3 flex items-center gap-3">
              <TabsList>
                <TabsTrigger value="board">
                  {translate('auto.components.agentTeam.TeamPage.tabBoard', 'Board')}
                </TabsTrigger>
                <TabsTrigger value="activity">
                  {translate('auto.components.agentTeam.TeamPage.tabActivity', 'Activity')}
                </TabsTrigger>
                <TabsTrigger value="needs-you">
                  {translate('auto.components.agentTeam.TeamPage.tabNeedsYou', 'Needs you')}
                  {needsYou > 0 ? (
                    <span className="rounded-full border border-agent-question/45 bg-agent-question/10 px-1.5 text-2xs font-semibold text-agent-question-text">
                      {needsYou}
                    </span>
                  ) : null}
                </TabsTrigger>
              </TabsList>
              {today && (today.activeMs > 0 || today.tokens > 0) ? (
                <span className="text-xs text-muted-foreground">
                  {translate(
                    'auto.components.agentTeam.TeamPage.today',
                    'Today: {{time}} active · {{tokens}} tokens',
                    { time: formatDuration(today.activeMs), tokens: formatTokens(today.tokens) }
                  )}
                </span>
              ) : null}
            </div>
            <TabsContent value="board" className="min-h-0 flex-1">
              <div className="h-full overflow-auto px-5 py-4 scrollbar-sleek">
                <TeamBoard
                  state={state}
                  onOpenSettings={openTeamSettings}
                  onOpenManager={() => setManagerView('docked')}
                />
              </div>
            </TabsContent>
            <TabsContent value="activity" className="min-h-0 flex-1">
              <div className="h-full overflow-auto px-5 py-4 scrollbar-sleek">
                <TeamActivity state={state} />
              </div>
            </TabsContent>
            <TabsContent value="needs-you" className="min-h-0 flex-1">
              <div className="h-full overflow-auto px-5 py-4 scrollbar-sleek">
                <TeamInbox state={state} active={tab === 'needs-you'} />
              </div>
            </TabsContent>
          </Tabs>
          {managerOpen ? (
            <TeamManagerPanel
              expanded={managerView === 'expanded'}
              onExpandedChange={(expanded) => setManagerView(expanded ? 'expanded' : 'docked')}
              onClose={() => setManagerView('closed')}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
