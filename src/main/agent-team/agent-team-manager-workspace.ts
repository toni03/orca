import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { composeAgentTeamManagerInstructions } from '../../shared/agent-team/agent-team-manager-prompt'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'

export const AGENT_TEAM_MANAGER_PROJECT_NAME = 'Agent Team Manager'

export function agentTeamManagerFolder(home = homedir()): string {
  return join(home, '.orca', 'agent-team', 'manager')
}

// CLAUDE.md imports AGENTS.md so Claude Code and AGENTS.md-aware CLIs read the same instructions.
const CLAUDE_POINTER = '<!-- Managed by Orca. -->\n\n@AGENTS.md\n'

async function writeIfChanged(path: string, text: string): Promise<void> {
  const current = await readFile(path, 'utf8').catch(() => null)
  if (current !== text) {
    await writeFile(path, text, 'utf8')
  }
}

/** Creates the Manager's own folder project, so its session never belongs to a user project. */
export async function ensureAgentTeamManagerWorkspace(
  runtime: OrcaRuntimeService
): Promise<string> {
  const folder = agentTeamManagerFolder()
  await mkdir(folder, { recursive: true })
  await writeIfChanged(join(folder, 'AGENTS.md'), composeAgentTeamManagerInstructions())
  await writeIfChanged(join(folder, 'CLAUDE.md'), CLAUDE_POINTER)
  // Reuses the registration when the folder is already a project.
  await runtime.addRepo(folder, 'folder', undefined, AGENT_TEAM_MANAGER_PROJECT_NAME)
  return folder
}
