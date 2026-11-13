import { useState } from 'react'
import { AtSign } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { nativeChatComposerDestination } from '../native-chat/composer/focus/native-chat-composer-destination'
import type { AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { issueKey } from './team-labels'
import { TeamProjectAvatar } from './TeamProjectAvatar'
import { sortByLabel } from '../../../../shared/agent-team/agent-team-name-order'

/** Inserts `#issue` or `@project` references into the Manager composer under `composerRoot`. */
export function TeamManagerMentions({
  state,
  composerRoot
}: {
  state: AgentTeamState
  composerRoot: React.RefObject<HTMLElement | null>
}): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const [open, setOpen] = useState(false)
  const projectIds = new Set([
    ...state.projects.map((project) => project.repoId),
    ...state.issues.map((issue) => issue.repoId)
  ])
  projectIds.delete(state.managerRepoId ?? '')
  const projects = sortByLabel(
    repos.filter((repo) => projectIds.has(repo.id)),
    (repo) => repo.displayName
  )
  const issues = state.issues
    .filter((issue) => issue.status !== 'done' && issue.status !== 'discarded')
    .sort((a, b) => a.priority - b.priority)
  const insert = (text: string): void => {
    nativeChatComposerDestination(composerRoot.current, null)?.insertTypedText(`${text} `)
    setOpen(false)
  }
  const label = translate(
    'auto.components.agentTeam.TeamManagerMentions.label',
    'Mention an issue or project'
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={label}>
              <AtSign />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {label}
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-1rem))]">
        <Command density="menu" label={label}>
          <CommandInput
            placeholder={translate(
              'auto.components.agentTeam.TeamManagerMentions.search',
              'Search issues and projects…'
            )}
          />
          <CommandList>
            <CommandEmpty>
              {translate('auto.components.agentTeam.TeamManagerMentions.empty', 'Nothing matches.')}
            </CommandEmpty>
            {issues.length > 0 ? (
              <CommandGroup
                heading={translate(
                  'auto.components.agentTeam.TeamManagerMentions.issues',
                  'Issues'
                )}
              >
                {issues.map((issue) => (
                  <CommandItem
                    key={issue.id}
                    value={`#${issueKey(issue)} ${issue.title}`}
                    onSelect={() => insert(`#${issueKey(issue)} (${issue.title})`)}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      #{issueKey(issue)}
                    </span>
                    <span className="truncate">{issue.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            <CommandGroup
              heading={translate(
                'auto.components.agentTeam.TeamManagerMentions.projects',
                'Projects'
              )}
            >
              {projects.map((repo) => (
                <CommandItem
                  key={repo.id}
                  value={`@${repo.displayName}`}
                  onSelect={() => insert(`@${repo.displayName}`)}
                >
                  <TeamProjectAvatar repo={repo} name={repo.displayName} />
                  <span className="truncate">{repo.displayName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
