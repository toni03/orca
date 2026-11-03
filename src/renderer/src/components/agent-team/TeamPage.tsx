import { useState } from 'react'
import { X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TeamBoard } from './TeamBoard'
import { TeamActivity } from './TeamActivity'
import { TeamSettings } from './TeamSettings'
import { useAgentTeamState } from './use-agent-team-state'

type TeamTab = 'board' | 'activity' | 'settings'

function isTeamTab(value: string): value is TeamTab {
  return value === 'board' || value === 'activity' || value === 'settings'
}

export default function TeamPage(): React.JSX.Element {
  const { state, loadError } = useAgentTeamState()
  const closeTeamPage = useAppStore((s) => s.closeTeamPage)
  const [tab, setTab] = useState<TeamTab>('board')
  const working = state?.issues.filter((issue) => issue.status === 'working').length ?? 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <h1 className="text-lg font-semibold">
          {translate('auto.components.agentTeam.TeamPage.title', 'Team')}
        </h1>
        {state ? (
          <span className="text-xs text-muted-foreground">
            {translate('auto.components.agentTeam.TeamPage.working', '{{count}} working', {
              count: working
            })}
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label={translate('auto.components.agentTeam.TeamPage.close', 'Close Team')}
          onClick={closeTeamPage}
        >
          <X />
        </Button>
      </div>
      {loadError ? (
        <p className="px-5 py-4 text-sm text-destructive">
          {translate(
            'auto.components.agentTeam.TeamPage.loadError',
            'Agent teams are not available in this window: {{message}}',
            { message: loadError }
          )}
        </p>
      ) : !state ? null : (
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (isTeamTab(value)) {
              setTab(value)
            }
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-5 mt-3">
            <TabsTrigger value="board">
              {translate('auto.components.agentTeam.TeamPage.tabBoard', 'Board')}
            </TabsTrigger>
            <TabsTrigger value="activity">
              {translate('auto.components.agentTeam.TeamPage.tabActivity', 'Activity')}
            </TabsTrigger>
            <TabsTrigger value="settings">
              {translate('auto.components.agentTeam.TeamPage.tabSettings', 'Settings')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="board" className="min-h-0 flex-1">
            <div className="h-full overflow-auto px-5 py-4 scrollbar-sleek">
              <TeamBoard state={state} onOpenSettings={() => setTab('settings')} />
            </div>
          </TabsContent>
          <TabsContent value="activity" className="min-h-0 flex-1">
            <div className="h-full overflow-auto px-5 py-4 scrollbar-sleek">
              <TeamActivity state={state} />
            </div>
          </TabsContent>
          <TabsContent value="settings" className="min-h-0 flex-1">
            <div className="h-full overflow-auto px-5 py-4 scrollbar-sleek">
              <TeamSettings state={state} />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
