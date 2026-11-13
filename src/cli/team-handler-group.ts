import type { HandlerGroup } from './handler-group-manifest'

export const TEAM_HANDLER_GROUP: HandlerGroup = {
  name: 'team',
  keys: [
    'team context',
    'team report',
    'team issues',
    'team issue answer',
    'team issue add',
    'team issue approve',
    'team issue hold',
    'team issue update',
    'team issue discard',
    'team seat pause',
    'team seat resume',
    'team seat update',
    'team seat add',
    'team seat retire',
    'team show',
    'team create',
    'team update',
    'team delete',
    'team step add',
    'team step update',
    'team step remove',
    'team roles',
    'team role show',
    'team role create',
    'team role update',
    'team role reset',
    'team role delete',
    'team project show',
    'team project update',
    'team group update',
    'team group remove'
  ],
  load: async () => (await import('./handlers/team.js')).TEAM_HANDLERS
}
