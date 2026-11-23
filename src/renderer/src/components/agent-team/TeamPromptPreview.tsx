import { useMemo, useState } from 'react'
import { translate } from '@/i18n/i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  composeAgentTeamSessionPrompt,
  type AgentTeamDelivery
} from '../../../../shared/agent-team/agent-team-session-prompt'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { sortByName } from '../../../../shared/agent-team/agent-team-name-order'

export function TeamPromptPreview({
  state,
  specText,
  delivery
}: {
  state: AgentTeamState
  specText: string | null
  delivery: AgentTeamDelivery
}): React.JSX.Element {
  const [roleId, setRoleId] = useState(sortByName(state.roles)[0]?.id ?? '')
  const role = state.roles.find((candidate) => candidate.id === roleId)
  const { folder, baseBranch } = delivery
  const prompt = useMemo(() => {
    if (!role) {
      return ''
    }
    return composeAgentTeamSessionPrompt({
      role,
      seat: { id: 'preview', name: 'Seat', agent: 'claude', instructions: '', createdAt: 0 },
      issue: {
        id: 'preview',
        repoId: '',
        teamId: '',
        title: translate(
          'auto.components.agentTeam.TeamSettingsProjects.sampleTitle',
          'Example issue title'
        ),
        body: '',
        criteria: [],
        status: 'working',
        priority: 0,
        scope: 'shared',
        dependsOn: [],
        stepIndex: 0,
        round: 1,
        assignments: [],
        createdAt: 0,
        updatedAt: 0
      },
      assignment: { id: '<assignment>' },
      projectSpec: specText,
      previousFindings: null,
      delivery: { folder, baseBranch }
    })
  }, [role, specText, folder, baseBranch])

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">
          {translate(
            'auto.components.agentTeam.TeamSettingsProjects.preview',
            'What a session receives'
          )}
        </h3>
        <Select value={roleId} onValueChange={setRoleId}>
          <SelectTrigger
            size="sm"
            className="ml-auto w-44"
            aria-label={translate(
              'auto.components.agentTeam.TeamSettingsProjects.previewRole',
              'Preview for role'
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortByName(state.roles).map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {candidate.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 font-mono text-2xs scrollbar-sleek">
        {prompt}
      </pre>
      <span className="text-xs text-muted-foreground">
        {translate(
          'auto.components.agentTeam.TeamSettingsProjects.previewHint',
          "Orca contract, role, project spec, seat instructions and the issue, in that order. The agent also reads the repository's AGENTS.md."
        )}
      </span>
    </div>
  )
}
