import { Users } from 'lucide-react'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import type { SettingsNavSection } from '@/lib/settings-navigation-types'
import { translateSearchKeyword } from '../search/settings-search-keywords'

export const getTeamSettingsSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.team.showButton', 'Show Team in the sidebar'),
    description: translate(
      'auto.components.settings.team.showButtonDescription',
      'Show the Team and Needs you entries in the sidebar.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.team.keywordTeam', 'team'),
      ...translateSearchKeyword('auto.components.settings.team.keywordSeats', 'seats'),
      ...translateSearchKeyword('auto.components.settings.team.keywordRoles', 'roles'),
      ...translateSearchKeyword('auto.components.settings.team.keywordTracker', 'tracker'),
      ...translateSearchKeyword('auto.components.settings.team.keywordManager', 'manager')
    ]
  }
])

export function getTeamSettingsNavSection(t: Translate = translate): SettingsNavSection {
  return {
    id: 'team',
    title: t('auto.components.settings.team.title', 'Team'),
    description: t(
      'auto.components.settings.team.description',
      'Teams, roles, projects and workflow of the agent team, and whether Team appears in the sidebar.'
    ),
    icon: Users,
    searchEntries: getTeamSettingsSearchEntries(),
    group: 'workflows'
  }
}
