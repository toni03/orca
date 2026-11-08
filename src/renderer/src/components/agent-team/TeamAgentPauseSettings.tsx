import { translate } from '@/i18n/i18n'
import { Switch } from '@/components/ui/switch'
import { AgentIcon, getAgentLabel } from '@/lib/agent-catalog'
import type { AgentTeamSeat, AgentTeamState } from '../../../../shared/agent-team/agent-team-types'
import { useAgentTeamCommand } from './use-agent-team-state'

/** Pauses every seat of one agent CLI at once, for example while its plan is out of credits. */
export function TeamAgentPauseSettings({
  state
}: {
  state: AgentTeamState
}): React.JSX.Element | null {
  const run = useAgentTeamCommand()
  const seatsByAgent = new Map<AgentTeamSeat['agent'], AgentTeamSeat[]>()
  for (const seat of state.seats) {
    if (seat.retiredAt === undefined) {
      seatsByAgent.set(seat.agent, [...(seatsByAgent.get(seat.agent) ?? []), seat])
    }
  }
  if (seatsByAgent.size === 0) {
    return null
  }
  return (
    <div className="flex max-w-md flex-col gap-2 text-sm">
      <span>
        {translate('auto.components.agentTeam.TeamAgentPauseSettings.title', 'Pause by agent')}
        <span className="block text-xs text-muted-foreground">
          {translate(
            'auto.components.agentTeam.TeamAgentPauseSettings.hint',
            'Pauses every seat that runs this agent, for example when its plan is out of credits. Running steps finish; queued work goes to the other seats. Pause one seat in Settings › Teams.'
          )}
        </span>
      </span>
      {[...seatsByAgent].map(([agent, seats]) => {
        const pausedCount = seats.filter((seat) => seat.paused === true).length
        return (
          <label key={agent} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2">
              <AgentIcon agent={agent} size={16} />
              {getAgentLabel(agent)}
              <span className="text-muted-foreground">
                {translate(
                  'auto.components.agentTeam.TeamAgentPauseSettings.count',
                  '{{paused}}/{{total}} seats paused',
                  { paused: pausedCount, total: seats.length }
                )}
              </span>
            </span>
            <Switch
              checked={pausedCount === seats.length}
              onCheckedChange={(paused) =>
                void run({ kind: 'seat.pause', seatIds: seats.map((seat) => seat.id), paused })
              }
            />
          </label>
        )
      })}
    </div>
  )
}
