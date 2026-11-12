import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgentTeamProject, AgentTeamSeat } from '../../shared/agent-team/agent-team-types'
import type { AgentLaunchPreferences } from '../../shared/agent-session/agent-session-host-authority'
import type { Store } from '../persistence/loading-store/store'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { effectiveProjectSpecStorage } from '../../shared/agent-team/agent-team-spec-storage'
import { quoteStartupArg } from '../../shared/agent-launch/startup/tui-agent-startup-shell'
import type { TuiAgent } from '../../shared/agent-launch/catalog/tui-agent'
import { resolveAgentTeamCliCommand } from './agent-team-cli-command'
import type { AgentTeamLauncher } from './agent-team-launcher'

/** Lets the report command print its answer before the tab goes away. */
const CLOSE_AFTER_REPORT_MS = 5_000

/** Repository-stored specs live at this path in the project's main checkout. */
export const AGENT_TEAM_PROJECT_SPEC_PATH = join('.orca', 'agent-team.md')

function launchPreferences(seat: AgentTeamSeat): AgentLaunchPreferences | undefined {
  return seat.model || seat.effort
    ? {
        ...(seat.model ? { model: seat.model } : {}),
        ...(seat.effort ? { effort: seat.effort } : {})
      }
    : undefined
}

/** Claude edits outside its cwd only for added dirs; other agents get the linked paths in the prompt. */
function extraDirArgs(agent: TuiAgent, dirs: readonly string[] | undefined): string | undefined {
  if (agent !== 'claude' || !dirs?.length) {
    return undefined
  }
  return dirs.map((dir) => `--add-dir ${quoteStartupArg(dir, 'posix')}`).join(' ')
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
    isFolderProject: (repoId) => store.getRepo(repoId)?.kind === 'folder',
    repoName: (repoId) => store.getRepo(repoId)?.displayName ?? repoId,
    async createLinkedWorktree({ repoId, name, baseBranch, title }) {
      const created = await runtime.createManagedWorktree({
        repoSelector: `id:${repoId}`,
        name,
        ...(baseBranch ? { baseBranch } : {}),
        displayName: title,
        displayNameKind: 'user',
        runHooks: false,
        setupDecision: 'run',
        activate: false,
        lineage: { noParent: true }
      })
      return {
        worktreeId: created.worktree.id,
        path: created.worktree.path,
        ...(created.worktree.branch ? { branch: created.worktree.branch } : {})
      }
    },
    async launchInNewWorktree({ repoId, name, baseBranch, seat, prompt, title, extraDirs }) {
      const repo = store.getRepo(repoId)
      const extraAgentArgs = extraDirArgs(seat.agent, extraDirs)
      if (repo?.kind === 'folder') {
        // No git to isolate a worktree: Build works in the folder, and every issue locks the project.
        const launched = await runtime.launchAgentTerminal(`path:${repo.path}`, {
          agent: seat.agent,
          prompt,
          title,
          suppressStartupUpdatePrompt: true,
          ...(launchPreferences(seat) ? { launchPreferences: launchPreferences(seat) } : {})
        })
        if (launched.ptyId) {
          ptyIdByHandle.set(launched.handle, launched.ptyId)
        }
        return { worktreeId: launched.worktreeId, terminalHandle: launched.handle }
      }
      const created = await runtime.createManagedWorktree({
        repoSelector: `id:${repoId}`,
        name,
        ...(baseBranch ? { baseBranch } : {}),
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
        ...(extraAgentArgs ? { startupExtraAgentArgs: extraAgentArgs } : {}),
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

    async launchInWorktree({ worktreeId, seat, prompt, title, extraDirs }) {
      const extraAgentArgs = extraDirArgs(seat.agent, extraDirs)
      const launched = await runtime.launchAgentTerminal(`id:${worktreeId}`, {
        agent: seat.agent,
        prompt,
        title,
        suppressStartupUpdatePrompt: true,
        ...(extraAgentArgs ? { extraAgentArgs } : {}),
        ...(launchPreferences(seat) ? { launchPreferences: launchPreferences(seat) } : {})
      })
      if (launched.ptyId) {
        ptyIdByHandle.set(launched.handle, launched.ptyId)
      }
      return { terminalHandle: launched.handle }
    },

    async readProjectSpec(project: AgentTeamProject | undefined, repoId: string) {
      const repo = store.getRepo(repoId)
      if (effectiveProjectSpecStorage(project, repo) === 'local') {
        return project?.localSpec?.trim() ? project.localSpec : null
      }
      if (!repo) {
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
    async sendToSession(terminalHandle, text) {
      await runtime.sendTerminalAgentPrompt(terminalHandle, text, {
        inputKind: 'driving'
      })
    },
    async closeSession(terminalHandle) {
      await new Promise((resolve) => setTimeout(resolve, CLOSE_AFTER_REPORT_MS))
      await runtime.closeTerminal(terminalHandle)
    },
    async findMergeRequest(repoId, branch) {
      const reply = await runtime.getHostedReviewForBranch({
        repoSelector: `id:${repoId}`,
        branch,
        force: true
      })
      const review = reply && 'readOutcome' in reply ? reply.review : reply
      return review ? { url: review.url, state: review.state, updatedAt: review.updatedAt } : null
    },
    async removeWorktree(worktreeId) {
      await runtime.removeManagedWorktree(`id:${worktreeId}`)
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
