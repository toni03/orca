import type { TaskPageComposerActionsModel } from './use-task-page-composer-actions'
import { TaskPageListChrome } from './ListChrome'
import { TaskPageContent } from './Content'
import { TaskPageNoConnectedSource } from './NoConnectedSource'
import { useTaskProviderConnections } from '@/components/feature-wall/setup/integrations/use-integration-connection-status'
import { areAllTaskProvidersDisconnected } from '../../../../shared/work-items/task-providers'
export function TaskPageFrame({
  model
}: {
  model: TaskPageComposerActionsModel
}): React.JSX.Element | null {
  const taskProviderConnections = useTaskProviderConnections(model.selectedRepos)
  // Why: a connected saved default can be restored outside the preferred list; pending sources keep the page.
  const noTaskProviderConnected = areAllTaskProvidersDisconnected(
    [...model.preferredVisibleTaskProviders, ...model.visibleTaskProviders],
    taskProviderConnections
  )
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Why: pt-1.5 (6px) aligns this 32px icon cluster's center with the sidebar Tasks row, 22px below the titlebar. */}
      <div className="mx-auto flex min-h-0 min-w-0 w-full flex-1 flex-col px-5 pt-1.5 pb-4 md:px-8 md:pt-1.5 md:pb-5">
        {noTaskProviderConnected ? (
          <TaskPageNoConnectedSource />
        ) : (
          <>
            <TaskPageListChrome model={model} />

            <TaskPageContent model={model} />
          </>
        )}
      </div>
    </div>
  )
}
