import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type {
  AgentTeamRole,
  AgentTeamState,
  AgentTeamStepType
} from '../../../../shared/agent-team/agent-team-types'
import { stepTypeLabel } from './team-labels'
import { useAgentTeamCommand } from './use-agent-team-state'

function originLabel(role: AgentTeamRole): string {
  switch (role.origin) {
    case 'builtin':
      return translate('auto.components.agentTeam.TeamSettingsRoles.builtin', 'Built-in')
    case 'organization':
      return translate('auto.components.agentTeam.TeamSettingsRoles.organization', 'Organization')
    case 'local':
      return role.templateId
        ? translate('auto.components.agentTeam.TeamSettingsRoles.customised', 'Customised')
        : translate('auto.components.agentTeam.TeamSettingsRoles.yours', 'Yours')
  }
}

function RoleEditor({
  role,
  state
}: {
  role: AgentTeamRole
  state: AgentTeamState
}): React.JSX.Element {
  const run = useAgentTeamCommand()
  const [name, setName] = useState(role.name)
  const [prompt, setPrompt] = useState(role.prompt)
  const [skills, setSkills] = useState(role.skills.join(', '))
  const usedBy = state.teams.flatMap((team) =>
    team.steps
      .filter((step) => step.roleId === role.id)
      .map((step) => `${team.name} · ${step.name}`)
  )
  const dirty = name !== role.name || prompt !== role.prompt || skills !== role.skills.join(', ')

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label={translate('auto.components.agentTeam.TeamSettingsRoles.name', 'Role name')}
          className="h-8 max-w-xs"
        />
        <Badge variant="outline">v{role.version}</Badge>
        {role.templateId && role.origin === 'local' ? (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => void run({ kind: 'role.reset', roleId: role.id })}
          >
            {translate('auto.components.agentTeam.TeamSettingsRoles.reset', 'Reset to template')}
          </Button>
        ) : null}
        {!role.templateId ? (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => void run({ kind: 'role.delete', roleId: role.id })}
          >
            {translate('auto.components.agentTeam.TeamSettingsRoles.delete', 'Delete role')}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {usedBy.length > 0
          ? translate('auto.components.agentTeam.TeamSettingsRoles.usedBy', 'Used by {{steps}}', {
              steps: usedBy.join(', ')
            })
          : translate(
              'auto.components.agentTeam.TeamSettingsRoles.unused',
              'No team step uses this role yet.'
            )}
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`agent-team-role-prompt-${role.id}`}>
            {translate('auto.components.agentTeam.TeamSettingsRoles.prompt', 'Prompt')}
          </Label>
          <Textarea
            id={`agent-team-role-prompt-${role.id}`}
            rows={12}
            variant="code"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <span className="text-xs text-muted-foreground">
            {translate(
              'auto.components.agentTeam.TeamSettingsRoles.promptHint',
              'At launch a session gets: the Orca contract, this role, the project spec, seat instructions and the issue. Each session records the version it used.'
            )}
          </span>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>
              {translate('auto.components.agentTeam.TeamSettingsRoles.stepType', 'Step type')}
            </Label>
            <RadioGroup
              value={role.stepType}
              onValueChange={(value) => {
                const stepType: AgentTeamStepType | null =
                  value === 'build' || value === 'check' ? value : null
                if (stepType) {
                  void run({ kind: 'role.update', roleId: role.id, stepType })
                }
              }}
            >
              <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                <RadioGroupItem value="build" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">{stepTypeLabel('build')}</span>
                  <span className="block text-xs text-muted-foreground">
                    {translate(
                      'auto.components.agentTeam.TeamSettingsRoles.buildHint',
                      'Own worktree, edits code. Hands back done or blocked.'
                    )}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                <RadioGroupItem value="check" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">{stepTypeLabel('check')}</span>
                  <span className="block text-xs text-muted-foreground">
                    {translate(
                      'auto.components.agentTeam.TeamSettingsRoles.checkHint',
                      'Reads and tests the Build worktree. Hands back pass or changes, with findings.'
                    )}
                  </span>
                </span>
              </label>
            </RadioGroup>
            <span className="text-xs text-muted-foreground">
              {translate(
                'auto.components.agentTeam.TeamSettingsRoles.stepTypeHint',
                'This is all Orca needs to route the issue. The name and prompt are yours.'
              )}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`agent-team-role-skills-${role.id}`}>
              {translate(
                'auto.components.agentTeam.TeamSettingsRoles.skills',
                'Skills, comma separated'
              )}
            </Label>
            <Input
              id={`agent-team-role-skills-${role.id}`}
              value={skills}
              variant="code"
              onChange={(event) => setSkills(event.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          disabled={!dirty}
          onClick={() => {
            setName(role.name)
            setPrompt(role.prompt)
            setSkills(role.skills.join(', '))
          }}
        >
          {translate('auto.components.agentTeam.TeamSettingsRoles.revert', 'Revert')}
        </Button>
        <Button
          disabled={!dirty || !name.trim()}
          onClick={() =>
            void run({
              kind: 'role.update',
              roleId: role.id,
              name,
              prompt,
              skills: skills.split(',')
            })
          }
        >
          {translate('auto.components.agentTeam.TeamSettingsRoles.save', 'Save role')}
        </Button>
      </div>
    </section>
  )
}

export function TeamSettingsRoles({ state }: { state: AgentTeamState }): React.JSX.Element {
  const run = useAgentTeamCommand()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const role = state.roles.find((candidate) => candidate.id === selectedId) ?? state.roles[0]

  const createRole = async (): Promise<void> => {
    const before = new Set(state.roles.map((candidate) => candidate.id))
    const next = await run({
      kind: 'role.create',
      name: translate('auto.components.agentTeam.TeamSettingsRoles.newRoleName', 'New role'),
      stepType: 'check',
      prompt: ''
    })
    const created = next?.roles.find((candidate) => !before.has(candidate.id))
    if (created) {
      setSelectedId(created.id)
    }
  }

  return (
    <div className="grid min-h-0 grid-cols-[240px_minmax(0,1fr)] gap-5">
      <section className="flex flex-col gap-1">
        <div className="mb-1 flex items-center">
          <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {translate('auto.components.agentTeam.TeamSettingsRoles.roles', 'Roles')}
          </h2>
          <Button size="xs" variant="outline" className="ml-auto" onClick={() => void createRole()}>
            {translate('auto.components.agentTeam.TeamSettingsRoles.newRole', 'New role')}
          </Button>
        </div>
        {state.roles.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            data-current={candidate.id === role?.id ? 'true' : undefined}
            onClick={() => setSelectedId(candidate.id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent',
              candidate.id === role?.id && 'bg-accent'
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{candidate.name}</span>
              <span className="block text-2xs text-muted-foreground">
                {stepTypeLabel(candidate.stepType)}
              </span>
            </span>
            <Badge variant="outline">{originLabel(candidate)}</Badge>
          </button>
        ))}
      </section>
      {role ? (
        <RoleEditor
          key={`${role.id}:${role.version}:${role.updatedAt}`}
          role={role}
          state={state}
        />
      ) : null}
    </div>
  )
}
