import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AgentChoiceControls } from '@/components/agent/launch-settings/AgentChoiceControls'
import { useAgentSettingsModelCatalog } from '@/components/agent/launch-settings/use-agent-settings-model-catalog'
import { sourceControlActionAgentPicksModel } from '../../../../shared/source-control/ai/recipes/source-control-action-options'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

// Team seats run on this computer, so its CLIs and accounts list the models.
const LOCAL_HOST: RuntimeClientTarget = { kind: 'local' }
const EFFORT_ONLY = ['effort']

export type TeamSeatModelChoice = { model: string; effort: string }

/** The seat's model and reasoning level from the agent's own list; free text for agents Orca cannot list. */
export function TeamSeatModelField({
  agent,
  value,
  onChange
}: {
  agent: TuiAgent
  value: TeamSeatModelChoice
  onChange: (value: TeamSeatModelChoice) => void
}): React.JSX.Element {
  const { catalog, usesSeedModels } = useAgentSettingsModelCatalog(agent, LOCAL_HOST)
  if (!sourceControlActionAgentPicksModel(agent)) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-team-seat-model">
          {translate('auto.components.agentTeam.TeamSeatDialog.model', 'Model')}
        </Label>
        <Input
          id="agent-team-seat-model"
          value={value.model}
          placeholder={translate(
            'auto.components.agentTeam.TeamSeatDialog.modelPlaceholder',
            "The agent's default"
          )}
          onChange={(event) => onChange({ ...value, model: event.target.value })}
        />
      </div>
    )
  }
  return (
    <AgentChoiceControls
      agent={agent}
      value={{
        ...(value.model ? { model: value.model } : {}),
        ...(value.effort ? { options: { effort: value.effort } } : {})
      }}
      optionIds={EFFORT_ONLY}
      liveCatalog={catalog}
      usesSeedModels={usesSeedModels}
      defaultLabels={{
        model: translate(
          'auto.components.agentTeam.TeamSeatDialog.modelPlaceholder',
          "The agent's default"
        )
      }}
      onChange={(next) =>
        onChange({ model: next?.model ?? '', effort: next?.options?.effort ?? '' })
      }
    />
  )
}
