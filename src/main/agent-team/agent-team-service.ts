import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  applyAgentTeamStateCommand,
  isAgentTeamEngineCommand,
  type AgentTeamCommand
} from '../../shared/agent-team/agent-team-commands'
import { AgentTeamMutationError } from '../../shared/agent-team/agent-team-mutations'
import type { AgentTeamState } from '../../shared/agent-team/agent-team-types'
import type { Store } from '../persistence/loading-store/store'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { AgentTeamEngine, AgentTeamError, type AgentTeamLauncher } from './agent-team-engine'
import {
  AGENT_TEAM_PROJECT_SPEC_PATH,
  createAgentTeamRuntimeLauncher,
  readRepositoryProjectSpec
} from './agent-team-runtime-launcher'
import { AgentTeamStore } from './agent-team-store'
import { buildAgentTeamContext, launchAgentTeamManager } from './agent-team-manager'
import { reconcileAgentTeamSessionsAfterRestart } from './agent-team-restart-reconcile'
import {
  startAgentTeamUsageCollector,
  type AgentTeamUsageSources
} from './agent-team-usage-collector'
import { effectiveProjectSpecStorage } from '../../shared/agent-team/agent-team-spec-storage'
import type { AgentTeamContext } from '../../shared/agent-team/agent-team-context'
import type { TuiAgent } from '../../shared/tui-agent'

const TICK_INTERVAL_MS = 30_000
const RECONCILE_DELAY_MS = 15_000
/** A seat runs `orca team report` before its turn ends; give that call time to land. */
const UNREPORTED_TURN_GRACE_MS = 20_000

export type AgentTeamProjectSpecRead = {
  storage: 'repository' | 'local'
  text: string
  /** Repository specs are read from this file; null when the repo is remote. */
  path: string | null
}

export class AgentTeamService {
  private readonly engine: AgentTeamEngine
  private readonly launcher: AgentTeamLauncher
  private readonly disposers: (() => void)[] = []

  constructor(
    private readonly store: AgentTeamStore,
    private readonly runtime: OrcaRuntimeService,
    private readonly repos: Store,
    private readonly usage: AgentTeamUsageSources
  ) {
    this.launcher = createAgentTeamRuntimeLauncher(runtime, repos)
    this.engine = new AgentTeamEngine(store, this.launcher)
  }

  start(): void {
    this.disposers.push(this.watchSessions())
    this.disposers.push(startAgentTeamUsageCollector(this.store, this.repos, this.usage))
    const timer = setInterval(() => void this.engine.tick(), TICK_INTERVAL_MS)
    timer.unref?.()
    this.disposers.push(() => clearInterval(timer))
    void this.engine.tick()
    // Give the terminal host time to re-attach surviving sessions before judging them.
    const reconcile = setTimeout(
      () =>
        void reconcileAgentTeamSessionsAfterRestart({
          state: () => this.store.get(),
          launcher: this.launcher,
          stopAssignment: (id, reason, detail) => this.engine.stopAssignment(id, reason, detail)
        }).then(() => this.engine.tick()),
      RECONCILE_DELAY_MS
    )
    reconcile.unref?.()
    this.disposers.push(() => clearTimeout(reconcile))
  }

  stop(): void {
    for (const dispose of this.disposers.splice(0)) {
      dispose()
    }
    this.store.flushSync()
  }

  getState(): AgentTeamState {
    return this.store.get()
  }

  subscribe(listener: (state: AgentTeamState) => void): () => void {
    return this.store.subscribe(listener)
  }

  execute(command: AgentTeamCommand): AgentTeamState {
    try {
      if (isAgentTeamEngineCommand(command)) {
        if (command.kind === 'issue.decide') {
          this.engine.decide(command.issueId, command.decision)
        } else {
          this.engine.report(command.assignmentId, command.result)
        }
        return this.store.get()
      }
      const next = this.store.update((state) =>
        applyAgentTeamStateCommand(state, command, { newId: randomUUID, now: Date.now() })
      )
      void this.engine.tick()
      return next
    } catch (error) {
      if (error instanceof AgentTeamMutationError || error instanceof AgentTeamError) {
        throw new Error(error.message)
      }
      throw error
    }
  }

  context(): Promise<AgentTeamContext> {
    return buildAgentTeamContext(this.store.get(), this.repos, (repoId) =>
      this.readProjectSpec(repoId)
    )
  }

  launchManager(args: {
    agent: TuiAgent
    request: string
  }): Promise<{ worktreeId: string; terminalHandle: string }> {
    return launchAgentTeamManager(this.runtime, args)
  }

  async readProjectSpec(repoId: string): Promise<AgentTeamProjectSpecRead> {
    const project = this.store.get().projects.find((candidate) => candidate.repoId === repoId)
    const repo = this.repos.getRepo(repoId)
    if (effectiveProjectSpecStorage(project, repo) === 'local') {
      return { storage: 'local', text: project?.localSpec ?? '', path: null }
    }
    if (!repo) {
      return { storage: 'repository', text: '', path: null }
    }
    return {
      storage: 'repository',
      text: (await readRepositoryProjectSpec(repo.path)) ?? '',
      path: join(repo.path, AGENT_TEAM_PROJECT_SPEC_PATH)
    }
  }

  async writeProjectSpec(repoId: string, text: string): Promise<void> {
    const project = this.store.get().projects.find((candidate) => candidate.repoId === repoId)
    const repo = this.repos.getRepo(repoId)
    if (effectiveProjectSpecStorage(project, repo) === 'local') {
      this.execute({ kind: 'project.update', repoId, patch: { localSpec: text } })
      return
    }
    if (!repo) {
      throw new Error('This project is no longer in Orca.')
    }
    const file = join(repo.path, AGENT_TEAM_PROJECT_SPEC_PATH)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, text, 'utf8')
  }

  /** Turns agent hook transitions of team sessions into Needs you items. */
  private watchSessions(): () => void {
    const pendingChecks = new Map<string, ReturnType<typeof setTimeout>>()
    const unsubscribe = this.runtime.agentTransitions.subscribe((change) => {
      if (change.kind !== 'moved' || !change.transition) {
        return
      }
      const handle = this.runtime.getTerminalHandleForPaneKey(change.paneKey)
      const assignment = handle ? this.engine.assignmentForTerminal(handle) : null
      if (!assignment) {
        return
      }
      if (change.transition === 'prompt-submitted') {
        clearTimeout(pendingChecks.get(assignment.id))
        pendingChecks.delete(assignment.id)
        this.engine.resumeAssignment(assignment.id)
        return
      }
      if (change.transition === 'needs-input') {
        this.engine.stopAssignment(
          assignment.id,
          'needs-input',
          'The session is waiting for your input.'
        )
        return
      }
      if (change.transition === 'turn-finished' || change.transition === 'errored') {
        clearTimeout(pendingChecks.get(assignment.id))
        const timer = setTimeout(() => {
          pendingChecks.delete(assignment.id)
          if (handle && this.engine.assignmentForTerminal(handle)?.id === assignment.id) {
            this.engine.stopAssignment(
              assignment.id,
              'needs-input',
              change.transition === 'errored'
                ? 'The session stopped with an error before reporting a result.'
                : 'The session finished its turn without reporting a result.'
            )
          }
        }, UNREPORTED_TURN_GRACE_MS)
        timer.unref?.()
        pendingChecks.set(assignment.id, timer)
      }
    })
    return () => {
      unsubscribe()
      for (const timer of pendingChecks.values()) {
        clearTimeout(timer)
      }
    }
  }
}

export function createAgentTeamService(
  runtime: OrcaRuntimeService,
  repos: Store,
  usage: AgentTeamUsageSources
): AgentTeamService {
  return new AgentTeamService(new AgentTeamStore(), runtime, repos, usage)
}
