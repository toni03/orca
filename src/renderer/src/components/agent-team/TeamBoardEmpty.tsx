import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'

/** No team exists yet: point at Settings. */
export function TeamBoardNoTeams({
  onOpenSettings
}: {
  onOpenSettings: () => void
}): React.JSX.Element {
  return (
    <div className="flex max-w-lg flex-col gap-3 py-8">
      <h2 className="text-base font-semibold">
        {translate('auto.components.agentTeam.TeamBoard.emptyTitle', 'Set up your first team')}
      </h2>
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.agentTeam.TeamBoard.emptyBody',
          'A team is a pipeline of Build and Check steps with seats that take issues from every project. Create one from a template, add seats and link your projects.'
        )}
      </p>
      <Button className="self-start" onClick={onOpenSettings}>
        {translate('auto.components.agentTeam.TeamBoard.openSettings', 'Open team settings')}
      </Button>
    </div>
  )
}

/** Teams exist but nothing is on the board for this filter. */
export function TeamBoardNoIssues({
  onOpenSettings,
  onOpenManager
}: {
  onOpenSettings: () => void
  onOpenManager: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border p-6">
      <h3 className="text-sm font-semibold">
        {translate('auto.components.agentTeam.TeamBoard.noIssues', 'No issues in the queue')}
      </h3>
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.agentTeam.TeamBoard.noIssuesBody',
          'Tell the Manager what you need, or link a project and its tracker in Settings › Team.'
        )}
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onOpenManager}>
          {translate('auto.components.agentTeam.TeamBoard.messageManager', 'Message the Manager')}
        </Button>
        <Button size="sm" variant="outline" onClick={onOpenSettings}>
          {translate('auto.components.agentTeam.TeamBoard.connectProject', 'Connect a project')}
        </Button>
      </div>
    </div>
  )
}
