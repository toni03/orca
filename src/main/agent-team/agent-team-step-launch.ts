import { replaceAgentTeamIssue } from '../../shared/agent-team/agent-team-pipeline'
import { linkedRepoIds } from '../../shared/agent-team/agent-team-project-groups'
import type {
  AgentTeam,
  AgentTeamAssignment,
  AgentTeamIssue,
  AgentTeamLinkedWorktree,
  AgentTeamRole,
  AgentTeamSeat,
  AgentTeamState
} from '../../shared/agent-team/agent-team-types'
import {
  agentTeamStepPrompt,
  agentTeamWorktreeName,
  type AgentTeamLauncher
} from './agent-team-launcher'
import type { AgentTeamStore } from './agent-team-store'

/**
 * A grouped issue's first Build: a worktree in every other repo of the group on the issue's branch.
 * Each one is saved on the issue as soon as it exists, so a failed launch still cleans it up.
 */
async function createLinkedWorktrees(
  store: AgentTeamStore,
  launcher: AgentTeamLauncher,
  state: AgentTeamState,
  issue: AgentTeamIssue,
  baseBranch: string | undefined
): Promise<AgentTeamLinkedWorktree[]> {
  const linked = [...(issue.linkedWorktrees ?? [])]
  for (const repoId of linkedRepoIds(state, issue.repoId)) {
    if (linked.some((entry) => entry.repoId === repoId)) {
      continue
    }
    const created = await launcher.createLinkedWorktree({
      repoId,
      name: agentTeamWorktreeName(issue),
      ...(baseBranch ? { baseBranch } : {}),
      title: `${issue.tracker?.key ?? issue.title} · ${launcher.repoName(repoId)}`
    })
    linked.push({ repoId, ...created })
    store.update((current) => {
      const latest = current.issues.find((candidate) => candidate.id === issue.id)
      return latest
        ? replaceAgentTeamIssue(current, { ...latest, linkedWorktrees: [...linked] })
        : current
    })
  }
  return linked
}

/** Starts one step's session: in the issue's worktree, or for a first Build in new worktrees. */
export async function launchAgentTeamStep(
  store: AgentTeamStore,
  launcher: AgentTeamLauncher,
  args: {
    state: AgentTeamState
    issue: AgentTeamIssue
    team: AgentTeam
    seat: AgentTeamSeat
    role: AgentTeamRole
    assignment: AgentTeamAssignment
  }
): Promise<{ terminalHandle: string; issuePatch: Partial<AgentTeamIssue> }> {
  const { state, issue, team, seat, role, assignment } = args
  const project = state.projects.find((candidate) => candidate.repoId === issue.repoId)
  const title = `${seat.name} · ${issue.tracker?.key ?? issue.title}`
  const baseBranch = project?.baseBranch?.trim() || undefined
  const linkedWorktrees =
    issue.worktreeId || role.stepType !== 'build'
      ? (issue.linkedWorktrees ?? [])
      : await createLinkedWorktrees(store, launcher, state, issue, baseBranch)
  const extraDirs = linkedWorktrees.map((linked) => linked.path)
  const prompt = await agentTeamStepPrompt(launcher, {
    role,
    seat,
    issue: { ...issue, linkedWorktrees },
    assignment,
    project
  })
  if (issue.worktreeId) {
    const launched = await launcher.launchInWorktree({
      worktreeId: issue.worktreeId,
      seat,
      prompt,
      title,
      extraDirs
    })
    return { terminalHandle: launched.terminalHandle, issuePatch: {} }
  }
  if (role.stepType !== 'build') {
    const step = team.steps[issue.stepIndex]
    throw new Error(`Step "${step?.name}" checks a worktree, but no Build step has created one.`)
  }
  const launched = await launcher.launchInNewWorktree({
    repoId: issue.repoId,
    name: agentTeamWorktreeName(issue),
    ...(baseBranch ? { baseBranch } : {}),
    seat,
    prompt,
    title,
    extraDirs
  })
  return {
    terminalHandle: launched.terminalHandle,
    issuePatch: {
      worktreeId: launched.worktreeId,
      ...(launched.branch ? { branch: launched.branch } : {})
    }
  }
}
