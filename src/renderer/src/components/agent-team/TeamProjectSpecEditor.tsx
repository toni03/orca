import { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EMPTY_PROJECT_SPEC } from '../../../../shared/agent-team/agent-team-builtin-templates'
import type { AgentTeamProject } from '../../../../shared/agent-team/agent-team-types'

export function TeamProjectSpecEditor({
  repoId,
  project
}: {
  repoId: string
  project: AgentTeamProject | undefined
}): React.JSX.Element {
  const [loaded, setLoaded] = useState<{ text: string; path: string | null } | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const storage = project?.specStorage ?? 'repository'

  useEffect(() => {
    let cancelled = false
    setLoaded(null)
    setError(null)
    window.api.agentTeam
      .readProjectSpec(repoId)
      .then((read) => {
        if (!cancelled) {
          setLoaded(read)
          setText(read.text)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      })
    return () => {
      cancelled = true
    }
  }, [repoId, storage])

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      await window.api.agentTeam.writeProjectSpec(repoId, text)
      setLoaded((current) => (current ? { ...current, text } : current))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">
          {translate('auto.components.agentTeam.TeamSettingsProjects.spec', 'Project spec')}
        </h3>
        {text.trim() === '' && loaded ? (
          <Button
            size="xs"
            variant="outline"
            className="ml-auto"
            onClick={() => setText(EMPTY_PROJECT_SPEC)}
          >
            {translate(
              'auto.components.agentTeam.TeamSettingsProjects.useTemplate',
              'Start from headings'
            )}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.agentTeam.TeamSettingsProjects.specHint',
          'How this project works: tracker labels, branches, checks. The Manager follows it when it registers and moves issues; every seat gets it on top of its role. A "## For <role>" section only reaches that role.'
        )}
      </p>
      <Textarea
        rows={14}
        variant="code"
        value={text}
        disabled={!loaded}
        aria-label={translate(
          'auto.components.agentTeam.TeamSettingsProjects.spec',
          'Project spec'
        )}
        onChange={(event) => setText(event.target.value)}
      />
      {loaded?.path ? (
        <span className="font-mono text-2xs text-muted-foreground">{loaded.path}</span>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!loaded || saving || text === loaded.text}
          onClick={() => void save()}
        >
          {translate('auto.components.agentTeam.TeamSettingsProjects.saveSpec', 'Save spec')}
        </Button>
      </div>
    </div>
  )
}
