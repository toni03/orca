import { ArrowRight } from 'lucide-react'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import { Button } from '@/components/ui/button'
import { TeamSettings } from '@/components/agent-team/TeamSettings'
import { useAgentTeamState } from '@/components/agent-team/use-agent-team-state'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'
import { SettingsSwitchRow } from '../form-controls/SettingsFormControls'
import { SettingsGroup } from '../section-layout/SettingsGroup'

export function TeamSettingsPane({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => Promise<void>
}): React.JSX.Element {
  const t = useTranslate()
  const openTeamPage = useAppStore((state) => state.openTeamPage)
  const { state, loadError } = useAgentTeamState()

  return (
    <div className="space-y-8">
      <SettingsGroup>
        <SettingsSwitchRow
          label={t('auto.components.settings.team.showButton', 'Show Team in the sidebar')}
          description={t(
            'auto.components.settings.team.showButtonDescription',
            'Show the Team and Needs you entries in the sidebar.'
          )}
          checked={settings.showTeamButton !== false}
          onChange={() =>
            void updateSettings({ showTeamButton: settings.showTeamButton === false })
          }
        />
        <div className="flex justify-end px-4 py-3">
          <Button size="sm" variant="outline" onClick={() => openTeamPage('board')}>
            {t('auto.components.settings.team.openTeam', 'Open Team')}
            <ArrowRight />
          </Button>
        </div>
      </SettingsGroup>
      {loadError ? (
        <p className="text-sm text-destructive">
          {t(
            'auto.components.agentTeam.TeamPage.loadError',
            'Agent teams are not available in this window: {{message}}',
            { message: loadError }
          )}
        </p>
      ) : state ? (
        <TeamSettings state={state} />
      ) : (
        <p aria-busy="true" className="text-sm text-muted-foreground">
          {t('auto.components.agentTeam.TeamPage.loading', 'Loading the team…')}
        </p>
      )}
    </div>
  )
}
