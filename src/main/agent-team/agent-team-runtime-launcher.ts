import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgentTeamProject, AgentTeamSeat } from '../../shared/agent-team/agent-team-types'
import type { AgentLaunchPreferences } from '../../shared/agent-session/agent-session-host-authority'
import type { Store } from '../persistence/loading-store/store'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { resolveAgentTeamCliCommand } from './agent-team-cli-command'
import type { AgentTeamLauncher } from './agent-team-engine'

/** Repository-stored specs live at this path in the project's main checkout. */
export const AGENT_TEAM_PROJECT_SPEC_PATH = join('.orca', 'agent-team.md')

function launchPreferences(seat: AgentTeamSeat): AgentLaunchPreferences | undefined {
  return seat.model ? { model: seat.model } : undefined
}

export async function readRepositoryProjectSpec(repoPath: string): Promise<string | null> {
  try {
    const text = await readFile(join(repoPath, AGENT_TEAM_PROJECT_SPEC_PATH), 'utf8')
    return text.trim() ? text : null
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export function createAgentTeamRuntimeLauncher(
  runtime: OrcaRuntimeService,
  store: Store
): AgentTeamLauncher {
  const ptyIdByHandle = new Map<string, string>()

  return {
    cliCommand: resolveAgentTeamCliCommand,
    async launchInNewWorktree({ repoId, name, seat, prompt, title }) {
      const created = await runtime.createManagedWorktree({
        repoSelector: `id:${repoId}`,
        name,
        displayName: title,
        displayNameKind: 'user',
        runHooks: false,
        setupDecision: 'run',
        awaitTerminalProvisioning: true,
        createdWithAgent: seat.agent,
        startupAgent: seat.agent,
        startupPrompt: prompt,
        startupLaunchSource: 'agent-team',
        startupSuppressUpdatePrompt: true,
        ...(launchPreferences(seat) ? { startupLaunchPreferences: launchPreferences(seat) } : {}),
        activate: false,
        lineage: { noParent: true }
      })
      const handle = created.startupTerminal?.handle
      if (!handle) {
        throw new Error(
          created.warning || 'The worktree was created, but no agent terminal started.'
        )
      }
      if (created.startupTerminal?.ptyId) {
        ptyIdByHandle.set(handle, created.startupTerminal.ptyId)
      }
      return {
        worktreeId: created.worktree.id,
        branch: created.worktree.branch,
        terminalHandle: handle
      }
    },

    async launchInWorktree({ worktreeId, seat, prompt, title }) {
      const launched = await runtime.launchAgentTerminal(`id:${worktreeId}`, {
        agent: seat.agent,
        prompt,
        title,
        suppressStartupUpdatePrompt: true,
        ...(launchPreferences(seat) ? { launchPreferences: launchPreferences(seat) } : {})
      })
      if (launched.ptyId) {
        ptyIdByHandle.set(launched.handle, launched.ptyId)
      }
      return { terminalHandle: launched.handle }
    },

    async readProjectSpec(project: AgentTeamProject | undefined, repoId: string) {
      if (project?.specStorage === 'local') {
        return project.localSpec?.trim() ? project.localSpec : null
      }
      const repo = store.getRepo(repoId)
      // Remote checkouts are not readable from here; their seats run with role and AGENTS.md only.
      if (!repo || repo.connectionId) {
        return null
      }
      return readRepositoryProjectSpec(repo.path)
    },

    async liveTerminals(handles) {
      const listed = await runtime
        .listTerminals(undefined, handles.length, { handles, requireFreshPtyLiveness: true })
        .catch(() => null)
      if (!listed) {
        return null
      }
      return new Map(
        listed.terminals
          .filter((terminal) => terminal.connected)
          .map((terminal) => [terminal.handle, terminal.ptyId])
      )
    },
    watchExit(terminalHandle, onExit, knownPtyId) {
      const ptyId = ptyIdByHandle.get(terminalHandle) ?? knownPtyId
      if (!ptyId) {
        return
      }
      const unsubscribe = runtime.subscribeToPtyExit(ptyId, () => {
        unsubscribe()
        ptyIdByHandle.delete(terminalHandle)
        onExit()
      })
    }
  }
}
