import type { CommandHandler } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'

export type SeatView = { id: string; name: string; agent: string; model?: string; effort?: string }

type TeamView = {
  id: string
  name: string
  paused: boolean
  steps: {
    id: string
    name: string
    roleId: string
    role: string
    stepType: string
    seats: SeatView[]
  }[]
}

export function seatLine(seat: SeatView): string {
  const runs = [seat.agent, seat.model, seat.effort].filter(Boolean).join(' · ')
  return `${seat.id}  ${seat.name} (${runs})`
}

function formatTeam(team: TeamView | null): string {
  if (!team) {
    return 'Done.'
  }
  const lines = [`${team.id}  ${team.name}${team.paused ? '  (paused)' : ''}`]
  team.steps.forEach((step, index) => {
    lines.push(
      `  ${index + 1}. ${step.id}  ${step.name}  role ${step.role} [${step.stepType}]${step.seats.length === 0 ? '  no seats' : ''}`
    )
    for (const seat of step.seats) {
      lines.push(`       ${seatLine(seat)}`)
    }
  })
  if (team.steps.length === 0) {
    lines.push('  No steps yet: add one with orca team step add.')
  }
  return lines.join('\n')
}

function positionFlag(flags: Map<string, string | boolean>): number | undefined {
  const raw = getOptionalStringFlag(flags, 'position')
  if (raw === undefined) {
    return undefined
  }
  const position = Number(raw)
  if (!Number.isInteger(position) || position < 1) {
    throw new Error('--position must be a whole number from 1.')
  }
  return position
}

/** Teams, their steps and seats from the CLI. */
export const TEAM_STRUCTURE_HANDLERS: Record<string, CommandHandler> = {
  'team show': async ({ flags, client, json }) => {
    const response = await client.call<{ team: TeamView }>('team.show', {
      teamId: getRequiredStringFlag(flags, 'team')
    })
    printResult(response, json, (result) => formatTeam(result.team))
  },
  'team create': async ({ flags, client, json }) => {
    const templateId = getOptionalStringFlag(flags, 'template')
    const response = await client.call<{ team: TeamView | null }>('team.create', {
      name: getRequiredStringFlag(flags, 'name'),
      ...(templateId ? { templateId } : {})
    })
    printResult(response, json, (result) => `Created\n${formatTeam(result.team)}`)
  },
  'team update': async ({ flags, client, json }) => {
    const name = getOptionalStringFlag(flags, 'name')
    const response = await client.call<{ team: TeamView | null }>('team.update', {
      teamId: getRequiredStringFlag(flags, 'team'),
      ...(name ? { name } : {})
    })
    printResult(response, json, (result) => `Updated\n${formatTeam(result.team)}`)
  },
  'team delete': async ({ flags, client, json }) => {
    const response = await client.call<{ deleted: string }>('team.delete', {
      teamId: getRequiredStringFlag(flags, 'team')
    })
    printResult(response, json, (result) => `Deleted ${result.deleted}; its seats are retired.`)
  },
  'team step add': async ({ flags, client, json }) => {
    const position = positionFlag(flags)
    const response = await client.call<{ team: TeamView | null }>('team.stepAdd', {
      teamId: getRequiredStringFlag(flags, 'team'),
      name: getRequiredStringFlag(flags, 'name'),
      roleId: getRequiredStringFlag(flags, 'role'),
      ...(position !== undefined ? { position } : {})
    })
    printResult(response, json, (result) => `Added the step\n${formatTeam(result.team)}`)
  },
  'team step update': async ({ flags, client, json }) => {
    const name = getOptionalStringFlag(flags, 'name')
    const roleId = getOptionalStringFlag(flags, 'role')
    const position = positionFlag(flags)
    const response = await client.call<{ team: TeamView | null }>('team.stepUpdate', {
      teamId: getRequiredStringFlag(flags, 'team'),
      stepId: getRequiredStringFlag(flags, 'step'),
      ...(name ? { name } : {}),
      ...(roleId ? { roleId } : {}),
      ...(position !== undefined ? { position } : {})
    })
    printResult(response, json, (result) => `Updated the step\n${formatTeam(result.team)}`)
  },
  'team step remove': async ({ flags, client, json }) => {
    const response = await client.call<{ team: TeamView | null }>('team.stepRemove', {
      teamId: getRequiredStringFlag(flags, 'team'),
      stepId: getRequiredStringFlag(flags, 'step')
    })
    printResult(
      response,
      json,
      (result) => `Removed the step and retired its seats\n${formatTeam(result.team)}`
    )
  },
  'team seat add': async ({ flags, client, json }) => {
    const name = getOptionalStringFlag(flags, 'name')
    const model = getOptionalStringFlag(flags, 'model')
    const effort = getOptionalStringFlag(flags, 'effort')
    const response = await client.call<{ seat: SeatView | null; team: TeamView | null }>(
      'team.seatAdd',
      {
        teamId: getRequiredStringFlag(flags, 'team'),
        stepId: getRequiredStringFlag(flags, 'step'),
        agent: getRequiredStringFlag(flags, 'agent'),
        ...(name ? { name } : {}),
        ...(model ? { model } : {}),
        ...(effort ? { effort } : {})
      }
    )
    printResult(response, json, (result) =>
      result.seat ? `Added ${seatLine(result.seat)}` : formatTeam(result.team)
    )
  },
  'team seat retire': async ({ flags, client, json }) => {
    const response = await client.call<{ retired: string }>('team.seatRetire', {
      seatId: getRequiredStringFlag(flags, 'seat')
    })
    printResult(
      response,
      json,
      (result) => `Retired ${result.retired}; it leaves its step and takes no more work.`
    )
  }
}
