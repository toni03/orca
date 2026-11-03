import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { TeamSettingsProjects } from './TeamSettingsProjects'
import { TeamSettingsRoles } from './TeamSettingsRoles'
import { TeamSettingsTeams } from './TeamSettingsTeams'
import { useAgentTeamCommand } from './use-agent-team-state'

type SettingsTab = 'teams' | 'roles' | 'projects' | 'workflow'

function isSettingsTab(value: string): value is SettingsTab {
  return value === 'teams' || value === 'roles' || value === 'projects' || value === 'workflow'
}

function NumberSetting({
  id,
  label,
  hint,
  value,
  onCommit
}: {
  id: string
  label: string
  hint: string
  value: number
  onCommit: (value: number) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        key={value}
        type="number"
        min={0}
        defaultValue={value}
        className="w-24"
        onBlur={(event) => {
          const next = Number(event.target.value)
          if (Number.isInteger(next) && next !== value) {
            onCommit(next)
          }
        }}
      />
      <span className="max-w-md text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}

function WorkflowSettings({ state }: { state: AgentTeamState }): React.JSX.Element {
  const run = useAgentTeamCommand()
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.agentTeam.TeamSettings.workflowHelp',
          'How issues move for every team. Seats and steps are in Teams; trackers and project specs in Projects.'
        )}
      </p>
      <NumberSetting
        id="agent-team-rounds"
        label={translate('auto.components.agentTeam.TeamSettings.rounds', 'Rounds per issue')}
        hint={translate(
          'auto.components.agentTeam.TeamSettings.roundsHint',
          'A rejected check starts a new round. After the last one the issue goes to Needs you.'
        )}
        value={state.workflow.roundsPerIssue}
        onCommit={(roundsPerIssue) =>
          void run({ kind: 'workflow.update', patch: { roundsPerIssue } })
        }
      />
      <NumberSetting
        id="agent-team-batch"
        label={translate(
          'auto.components.agentTeam.TeamSettings.batch',
          'Propose the next batch below'
        )}
        hint={translate(
          'auto.components.agentTeam.TeamSettings.batchHint',
          'The Manager proposes approved issues when fewer than this many are queued.'
        )}
        value={state.workflow.batchThreshold}
        onCommit={(batchThreshold) =>
          void run({ kind: 'workflow.update', patch: { batchThreshold } })
        }
      />
      <label className="flex max-w-md items-center justify-between gap-3 text-sm">
        <span>
          {translate('auto.components.agentTeam.TeamSettings.paused', 'Pause the team')}
          <span className="block text-xs text-muted-foreground">
            {translate(
              'auto.components.agentTeam.TeamSettings.pausedHint',
              'Running steps finish; nothing new starts until you resume.'
            )}
          </span>
        </span>
        <Switch
          checked={state.workflow.paused}
          onCheckedChange={(paused) => void run({ kind: 'workflow.update', patch: { paused } })}
        />
      </label>
    </div>
  )
}

export function TeamSettings({ state }: { state: AgentTeamState }): React.JSX.Element {
  const [tab, setTab] = useState<SettingsTab>('teams')
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        if (isSettingsTab(value)) {
          setTab(value)
        }
      }}
      className="flex flex-col"
    >
      <TabsList size="sm" className="mb-4">
        <TabsTrigger value="teams">
          {translate('auto.components.agentTeam.TeamSettings.teams', 'Teams')}
        </TabsTrigger>
        <TabsTrigger value="roles">
          {translate('auto.components.agentTeam.TeamSettings.roles', 'Roles')}
        </TabsTrigger>
        <TabsTrigger value="projects">
          {translate('auto.components.agentTeam.TeamSettings.projects', 'Projects')}
        </TabsTrigger>
        <TabsTrigger value="workflow">
          {translate('auto.components.agentTeam.TeamSettings.workflow', 'Workflow')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="teams">
        <TeamSettingsTeams state={state} />
      </TabsContent>
      <TabsContent value="roles">
        <TeamSettingsRoles state={state} />
      </TabsContent>
      <TabsContent value="projects">
        <TeamSettingsProjects state={state} />
      </TabsContent>
      <TabsContent value="workflow">
        <WorkflowSettings state={state} />
      </TabsContent>
    </Tabs>
  )
}
