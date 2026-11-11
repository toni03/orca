import { useState } from 'react'
import { Ellipsis, Plus } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { AgentTeamRole, AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { TeamIconButton } from './TeamIconButton'
import { TeamSkillsInput } from './TeamSkillsInput'
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

function sameSkills(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((skill, index) => skill === b[index])
}

function RoleActions({ role }: { role: AgentTeamRole }): React.JSX.Element | null {
  const run = useAgentTeamCommand()
  const canReset = Boolean(role.templateId) && role.origin === 'local'
  const canDelete = !role.templateId
  if (!canReset && !canDelete) {
    return null
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TeamIconButton
          size="icon-sm"
          className="ml-auto"
          label={translate(
            'auto.components.agentTeam.TeamSettingsRoles.roleActions',
            'Role actions'
          )}
        >
          <Ellipsis />
        </TeamIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canReset ? (
          <DropdownMenuItem onSelect={() => void run({ kind: 'role.reset', roleId: role.id })}>
            {translate('auto.components.agentTeam.TeamSettingsRoles.reset', 'Reset to template')}
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => void run({ kind: 'role.delete', roleId: role.id })}
          >
            {translate('auto.components.agentTeam.TeamSettingsRoles.delete', 'Delete role')}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
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
  const [skills, setSkills] = useState(role.skills)
  const usedBy = state.teams.flatMap((team) =>
    team.steps
      .filter((step) => step.roleId === role.id)
      .map((step) => `${team.name} › ${step.name}`)
  )
  const dirty = name !== role.name || prompt !== role.prompt || !sameSkills(skills, role.skills)

  return (
    <section className="flex min-w-0 flex-col gap-5">
      <p className="text-xs text-muted-foreground">
        v{role.version} ·{' '}
        {usedBy.length > 0
          ? translate('auto.components.agentTeam.TeamSettingsRoles.usedBy', 'Used by {{steps}}', {
              steps: usedBy.join(', ')
            })
          : translate(
              'auto.components.agentTeam.TeamSettingsRoles.unused',
              'No team step uses this role yet.'
            )}
      </p>
      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-60 flex-1 flex-col gap-1.5">
          <Label htmlFor={`agent-team-role-name-${role.id}`}>
            {translate('auto.components.agentTeam.TeamSettingsRoles.nameLabel', 'Name')}
          </Label>
          <Input
            id={`agent-team-role-name-${role.id}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="flex min-w-72 flex-1 flex-col gap-1.5">
          <Label id={`agent-team-role-type-${role.id}`}>
            {translate('auto.components.agentTeam.TeamSettingsRoles.stepType', 'Step type')}
          </Label>
          <ToggleGroup
            type="single"
            variant="segmented-card"
            aria-labelledby={`agent-team-role-type-${role.id}`}
            value={role.stepType}
            onValueChange={(value) => {
              if (value === 'build' || value === 'check') {
                void run({ kind: 'role.update', roleId: role.id, stepType: value })
              }
            }}
          >
            <ToggleGroupItem value="build">{stepTypeLabel('build')}</ToggleGroupItem>
            <ToggleGroupItem value="check">{stepTypeLabel('check')}</ToggleGroupItem>
          </ToggleGroup>
          <span className="text-xs text-muted-foreground">
            {role.stepType === 'build'
              ? translate(
                  'auto.components.agentTeam.TeamSettingsRoles.buildHint',
                  'Own worktree, edits code. Hands back done or blocked.'
                )
              : translate(
                  'auto.components.agentTeam.TeamSettingsRoles.checkHint',
                  'Reads and tests the Build worktree. Hands back pass or changes, with findings.'
                )}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Label htmlFor={`agent-team-role-prompt-${role.id}`}>
            {translate('auto.components.agentTeam.TeamSettingsRoles.prompt', 'Prompt')}
          </Label>
          <span className="text-xs text-muted-foreground">
            {translate(
              'auto.components.agentTeam.TeamSettingsRoles.promptHint',
              'At launch a session gets: the Orca contract, this role, the project spec, seat instructions and the issue. Each session records the version it used.'
            )}
          </span>
        </div>
        <Textarea
          id={`agent-team-role-prompt-${role.id}`}
          rows={16}
          variant="code"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`agent-team-role-skills-${role.id}`}>
          {translate('auto.components.agentTeam.TeamSettingsRoles.skillsLabel', 'Skills')}
        </Label>
        <TeamSkillsInput
          id={`agent-team-role-skills-${role.id}`}
          skills={skills}
          onChange={setSkills}
        />
      </div>
      {dirty ? (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm">
          <span className="size-2 rounded-full bg-agent-question" />
          <span className="text-xs">
            {translate(
              'auto.components.agentTeam.TeamSettingsRoles.unsaved',
              'Unsaved changes · saves as v{{version}}',
              { version: role.version + 1 }
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setName(role.name)
              setPrompt(role.prompt)
              setSkills(role.skills)
            }}
          >
            {translate('auto.components.agentTeam.TeamSettingsRoles.revert', 'Revert')}
          </Button>
          <Button
            size="sm"
            disabled={!name.trim()}
            onClick={() => void run({ kind: 'role.update', roleId: role.id, name, prompt, skills })}
          >
            {translate('auto.components.agentTeam.TeamSettingsRoles.save', 'Save role')}
          </Button>
        </div>
      ) : null}
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
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        {role ? (
          <Select value={role.id} onValueChange={setSelectedId}>
            <SelectTrigger
              className="h-9 w-80"
              aria-label={translate('auto.components.agentTeam.TeamSettingsRoles.roles', 'Roles')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {state.roles.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  <span className="font-semibold">{candidate.name}</span>
                  <Badge variant="outline" className="ml-2">
                    {stepTypeLabel(candidate.stepType)}
                  </Badge>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {originLabel(candidate)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Button size="sm" variant="outline" className="h-9" onClick={() => void createRole()}>
          <Plus />
          {translate('auto.components.agentTeam.TeamSettingsRoles.newRole', 'New role')}
        </Button>
        {role ? <RoleActions role={role} /> : null}
      </div>
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
