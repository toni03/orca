import { useState } from 'react'
import { X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { isImeOwnedKeyboardEvent } from '@/lib/text-input/ime/ime-composition-keyboard-event'
import { TeamIconButton } from './TeamIconButton'

/** Skill names as removable chips; Enter, comma or leaving the field adds what was typed. */
export function TeamSkillsInput({
  id,
  skills,
  onChange
}: {
  id: string
  skills: string[]
  onChange: (skills: string[]) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const commit = (): void => {
    const added = draft
      .split(',')
      .map((skill) => skill.trim())
      .filter((skill) => skill && !skills.includes(skill))
    if (added.length > 0) {
      onChange([...skills, ...added])
    }
    setDraft('')
  }
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input px-1.5 py-1 focus-within:border-ring dark:bg-input/30">
      {skills.map((skill) => (
        <span
          key={skill}
          className="flex h-6 items-center gap-0.5 rounded-sm bg-muted pl-2 font-mono text-2xs"
        >
          {skill}
          <TeamIconButton
            className="size-5"
            label={translate(
              'auto.components.agentTeam.TeamSkillsInput.remove',
              'Remove {{skill}}',
              {
                skill
              }
            )}
            onClick={() => onChange(skills.filter((candidate) => candidate !== skill))}
          >
            <X />
          </TeamIconButton>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={translate('auto.components.agentTeam.TeamSkillsInput.add', 'Add skill…')}
        className="h-6 min-w-32 flex-1 bg-transparent px-1 font-mono text-xs outline-none placeholder:text-muted-foreground"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (isImeOwnedKeyboardEvent(event)) {
            return
          }
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Backspace' && !draft && skills.length > 0) {
            onChange(skills.slice(0, -1))
          }
        }}
      />
    </div>
  )
}
