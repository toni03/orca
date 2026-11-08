import type { HandlerGroup } from './handler-group-manifest'

export const TEAM_HANDLER_GROUP: HandlerGroup = {
  name: 'team',
  keys: [
    'team context',
    'team report',
    'team issues',
    'team issue answer',
    'team issue add',
    'team seat pause',
    'team seat resume'
  ],
  load: async () => (await import('./handlers/team.js')).TEAM_HANDLERS
}
