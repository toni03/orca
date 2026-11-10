import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  applyAgentTeamStateCommand,
  isAgentTeamEngineCommand,
  type AgentTeamCommand,
  type AgentTeamStateCommand
} from '../../shared/agent-team/agent-team-commands'
import { AgentTeamMutationError } from '../../shared/agent-team/agent-team-mutations'
import type { AgentTeamState } from '../../shared/agent-team/agent-team-types'
import type { Store } from '../persistence/loading-store/store'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { AgentTeamEngine, AgentTeamError } from './agent-team-engine'
import type { AgentTeamLauncher } from './agent-team-launcher'
import {
  AGENT_TEAM_PROJECT_SPEC_PATH,
  createAgentTeamRuntimeLauncher,
  readRepositoryProjectSpec
} from './agent-team-runtime-launcher'
import { AgentTeamStore } from './agent-team-store'
import {
  buildAgentTeamContext,
  findLiveManagerSession,
  launchAgentTeamManager
} from './agent-team-manager'
import { agentTeamManagerFolder } from './agent-team-manager-workspace'
import type {
  AgentTeamIssueLiveStatus,
  AgentTeamManagerActivity,
  AgentTeamManagerSession
} from '../../shared/agent-team/agent-team-ipc'
import { readAgentTeamIssueLiveStatus } from './agent-team-issue-status'
import { reconcileAgentTeamSessionsAfterRestart } from './agent-team-restart-reconcile'
import { AgentTeamTrackerSync } from './agent-team-tracker-sync'
import { startAgentTeamMobileAlerts } from './agent-team-mobile-alerts'
import {
  readManagerActivity,
  startAgentTeamUsageCollector,
  type AgentTeamUsageSources
} from './agent-team-usage-collector'
import { effectiveProjectSpecStorage } from '../../shared/agent-team/agent-team-spec-storage'
import type { AgentTeamContext } from '../../shared/agent-team/agent-team-context'
import type { TuiAgent } from '../../shared/agent-launch/catalog/tui-agent'
import { getRepoRoutingConnectionId } from '../../shared/execution-host'
import { watchAgentTeamPlanLimits } from './agent-team-plan-limit-watch'
import type { RateLimitService } from '../rate-limits/service/rate-limit-service'

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
  private readonly trackerSync: AgentTeamTrackerSync
  private readonly disposers: (() => void)[] = []

  constructor(
    private readonly store: AgentTeamStore,
    private readonly runtime: OrcaRuntimeService,
    private readonly repos: Store,
    private readonly usage: AgentTeamUsageSources,
    private readonly planLimits: () => RateLimitService | null = () => null
  ) {
    this.launcher = createAgentTeamRuntimeLauncher(runtime, repos)
    this.trackerSync = new AgentTeamTrackerSync(store, runtime, repos)
    this.engine = new AgentTeamEngine(store, this.launcher)
  }

  start(): void {
    this.disposers.push(this.watchSessions())
    this.disposers.push(
      startAgentTeamUsageCollector(
        this.store,
        (repoId) => {
          const repo = this.repos.getRepo(repoId)
          return repo ? getRepoRoutingConnectionId(repo) !== null : false
        },
        this.usage
      )
    )
    this.disposers.push(this.trackerSync.start())
    this.disposers.push(
      watchAgentTeamPlanLimits(this.planLimits(), this.store, () => void this.engine.tick())
    )
    this.disposers.push(
      startAgentTeamMobileAlerts({
        getState: () => this.store.get(),
        subscribe: (listener) => this.store.subscribe(listener),
        projectName: (repoId) => this.repos.getRepo(repoId)?.displayName ?? repoId,
        dispatch: (event) => this.runtime.dispatchMobileNotification(event)
      })
    )
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
          stopAssignment: (id, reason, detail) =>
            void this.engine.stopUnreported(id, reason, detail)
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
      const ruled = this.withFolderRules(command)
      const next = this.store.update((state) =>
        applyAgentTeamStateCommand(state, ruled, { newId: randomUUID, now: Date.now() })
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

  async launchManager(args: {
    agent: TuiAgent
    request: string
  }): Promise<AgentTeamManagerSession> {
    const pending = this.trackerSync.peekPending()
    const launched = await launchAgentTeamManager(this.runtime, {
      ...args,
      ...(pending ? { pendingUpdates: pending.message } : {})
    })
    if (this.store.get().managerRepoId !== launched.managerRepoId) {
      this.store.update((state) => ({ ...state, managerRepoId: launched.managerRepoId }))
    }
    // A reused session gets pending moves from the delivery loop once it is idle.
    if (pending && launched.startedNew) {
      this.trackerSync.markSent(pending.events)
    }
    return launched.session
  }

  /** The live Manager session, so the Team page can show it without starting one. */
  managerSession(): Promise<AgentTeamManagerSession | null> {
    return findLiveManagerSession(this.runtime, agentTeamManagerFolder())
  }

  /** Display names for clients without the repo list, e.g. Orca Mobile. */
  projectLabels(): { repoId: string; name: string; color: string | null }[] {
    return this.store.get().projects.map((project) => {
      const repo = this.repos.getRepo(project.repoId)
      return {
        repoId: project.repoId,
        name: repo?.displayName ?? project.repoId,
        color: repo?.badgeColor ?? null
      }
    })
  }

  issueLiveStatus(issueId: string): Promise<AgentTeamIssueLiveStatus> {
    const issue = this.store.get().issues.find((candidate) => candidate.id === issueId)
    return issue
      ? readAgentTeamIssueLiveStatus(this.runtime, issue)
      : Promise.resolve({ tracker: null, review: null })
  }

  managerActivity(from: number, to: number): Promise<AgentTeamManagerActivity> {
    return readManagerActivity(this.usage, this.store.get().managerRepoId, from, to)
  }

  /** Folder projects share one directory, so their issues always lock the project. */
  private withFolderRules(command: AgentTeamStateCommand): AgentTeamStateCommand {
    const isFolder = (repoId: string): boolean => this.repos.getRepo(repoId)?.kind === 'folder'
    if (command.kind === 'issue.create' && isFolder(command.repoId)) {
      return { ...command, scope: 'exclusive' }
    }
    if (command.kind === 'issue.update' && command.scope === 'shared') {
      const issue = this.store.get().issues.find((candidate) => candidate.id === command.issueId)
      if (issue && isFolder(issue.repoId)) {
        return { ...command, scope: 'exclusive' }
      }
    }
    return command
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
            void this.engine.stopUnreported(
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
  usage: AgentTeamUsageSources,
  planLimits?: () => RateLimitService | null
): AgentTeamService {
  return new AgentTeamService(new AgentTeamStore(), runtime, repos, usage, planLimits)
}
