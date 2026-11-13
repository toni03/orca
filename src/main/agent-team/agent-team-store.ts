import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getAppEnvironment } from '../../shared/app-environment'
import {
  BUILTIN_ROLE_TEMPLATES,
  builtinRole,
  createInitialAgentTeamState
} from '../../shared/agent-team/agent-team-builtin-templates'
import { withConsistentSeats } from '../../shared/agent-team/agent-team-seat-membership'
import type { AgentTeamState } from '../../shared/agent-team/agent-team-types'
import {
  durableWriteTempPath,
  writeFileDurable,
  writeFileDurableSync
} from '../filesystem/durable-file-write'

const SAVE_DEBOUNCE_MS = 300

function isAgentTeamState(value: unknown): value is AgentTeamState {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return (
    'version' in value &&
    value.version === 1 &&
    'roles' in value &&
    Array.isArray(value.roles) &&
    'teams' in value &&
    Array.isArray(value.teams) &&
    'seats' in value &&
    Array.isArray(value.seats) &&
    'projects' in value &&
    Array.isArray(value.projects) &&
    'issues' in value &&
    Array.isArray(value.issues) &&
    'workflow' in value &&
    typeof value.workflow === 'object' &&
    value.workflow !== null
  )
}

/** Built-in roles shipped after the file was written show up, and unedited ones follow prompt updates. */
function withBuiltinRoles(state: AgentTeamState, now: number): AgentTeamState {
  const known = new Set(state.roles.map((role) => role.id))
  const missing = BUILTIN_ROLE_TEMPLATES.filter((template) => !known.has(template.id))
  const roles = state.roles.map((role) => {
    const template = BUILTIN_ROLE_TEMPLATES.find((candidate) => candidate.id === role.templateId)
    const shipped = template?.version ?? 1
    if (!template || role.origin !== 'builtin' || (role.templateVersion ?? 1) >= shipped) {
      return role
    }
    return {
      ...role,
      prompt: template.prompt,
      version: role.version + 1,
      templateVersion: shipped
    }
  })
  return {
    ...state,
    roles: [...roles, ...missing.map((template) => builtinRole(template, now))]
  }
}

export function readAgentTeamState(file: string, now: number): AgentTeamState {
  if (!existsSync(file)) {
    return createInitialAgentTeamState(now)
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (isAgentTeamState(parsed)) {
      return withConsistentSeats(withBuiltinRoles(parsed, now), now)
    }
  } catch {
    // Fall through: keep the unreadable file aside instead of overwriting the user's data.
  }
  copyFileSync(file, `${file}.unreadable-${now}`)
  return createInitialAgentTeamState(now)
}

export class AgentTeamStore {
  private state: AgentTeamState
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private writing: Promise<void> = Promise.resolve()
  private readonly listeners = new Set<(state: AgentTeamState) => void>()

  constructor(
    private readonly file = join(getAppEnvironment().getPath('userData'), 'orca-agent-team.json')
  ) {
    this.state = readAgentTeamState(this.file, Date.now())
  }

  get(): AgentTeamState {
    return this.state
  }

  update(mutate: (state: AgentTeamState) => AgentTeamState): AgentTeamState {
    const next = mutate(this.state)
    if (next === this.state) {
      return next
    }
    this.state = next
    this.scheduleSave()
    for (const listener of this.listeners) {
      listener(next)
    }
    return next
  }

  subscribe(listener: (state: AgentTeamState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      const payload = JSON.stringify(this.state, null, 2)
      this.writing = this.writing
        .then(() => writeFileDurable(durableWriteTempPath(this.file), this.file, payload))
        .catch((error: unknown) => console.error('[agent-team] save failed', error))
    }, SAVE_DEBOUNCE_MS)
  }

  /** Quit path: write synchronously so the last change survives. */
  flushSync(): void {
    if (!this.saveTimer) {
      return
    }
    clearTimeout(this.saveTimer)
    this.saveTimer = null
    writeFileDurableSync(
      durableWriteTempPath(this.file),
      this.file,
      JSON.stringify(this.state, null, 2)
    )
  }
}
