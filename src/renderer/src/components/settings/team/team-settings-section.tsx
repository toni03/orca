import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import { SettingsSection } from '../section-layout/SettingsSection'
import type { SettingsRenderContext } from '../page/settings-render-context'
import { TeamSettingsPane } from './TeamSettingsPane'

export function renderTeamSettingsSection(
  context: SettingsRenderContext,
  t: Translate = translate
): React.JSX.Element {
  const { model, navigation, view } = context
  return (
    <SettingsSection
      id="team"
      title={t('auto.components.settings.team.title', 'Team')}
      description={t(
        'auto.components.settings.team.description',
        'Teams, roles, projects and workflow of the agent team, and whether Team appears in the sidebar.'
      )}
      searchEntries={navigation.getSectionSearchEntries('team')}
    >
      {view.isSectionMounted('team') ? (
        <TeamSettingsPane settings={model.settings} updateSettings={model.updateSettings} />
      ) : null}
    </SettingsSection>
  )
}
