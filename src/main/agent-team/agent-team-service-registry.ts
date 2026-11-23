import type { AgentTeamService } from './agent-team-service'

// The RPC layer is built before desktop-only services start, so it reads the service late.
let current: AgentTeamService | null = null

export function setAgentTeamService(service: AgentTeamService | null): void {
  current = service
}

export function requireAgentTeamService(): AgentTeamService {
  if (!current) {
    throw new Error('Agent teams run in the Orca desktop app; open Orca and try again.')
  }
  return current
}
