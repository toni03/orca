import { translate } from '@/i18n/i18n'
import type { OrcaTeamCommandKind } from '../../../../../../shared/native-chat/tools/native-chat-orca-team-command'

/** Agent team CLI calls by what they did; keys stay literal for extraction. */
export function teamClause(kind: OrcaTeamCommandKind, count: number, live: boolean): string {
  switch (kind) {
    case 'context':
      return live
        ? translate('components.native-chat.tool.team.contextLive', 'Reading the team state')
        : translate(
            'components.native-chat.tool.team.context',
            'Read the team state {{count}} times',
            {
              count,
              defaultValue_one: 'Read the team state'
            }
          )
    case 'issues':
      return live
        ? translate('components.native-chat.tool.team.issuesLive', 'Listing issues')
        : translate('components.native-chat.tool.team.issues', 'Listed issues {{count}} times', {
            count,
            defaultValue_one: 'Listed issues'
          })
    case 'issueAdd':
      return live
        ? translate('components.native-chat.tool.team.issueAddLive', 'Adding issues')
        : translate('components.native-chat.tool.team.issueAdd', 'Added {{count}} issues', {
            count,
            defaultValue_one: 'Added {{count}} issue'
          })
    case 'issueApprove':
      return live
        ? translate('components.native-chat.tool.team.issueApproveLive', 'Approving issues')
        : translate(
            'components.native-chat.tool.team.issueApprove',
            'Approved issues {{count}} times',
            {
              count,
              defaultValue_one: 'Approved issues'
            }
          )
    case 'issueHold':
      return live
        ? translate('components.native-chat.tool.team.issueHoldLive', 'Holding issues')
        : translate('components.native-chat.tool.team.issueHold', 'Held issues {{count}} times', {
            count,
            defaultValue_one: 'Held issues'
          })
    case 'issueUpdate':
      return live
        ? translate('components.native-chat.tool.team.issueUpdateLive', 'Updating issues')
        : translate('components.native-chat.tool.team.issueUpdate', 'Updated {{count}} issues', {
            count,
            defaultValue_one: 'Updated {{count}} issue'
          })
    case 'issueDiscard':
      return live
        ? translate('components.native-chat.tool.team.issueDiscardLive', 'Discarding issues')
        : translate(
            'components.native-chat.tool.team.issueDiscard',
            'Discarded issues {{count}} times',
            {
              count,
              defaultValue_one: 'Discarded issues'
            }
          )
    case 'issueAnswer':
      return live
        ? translate('components.native-chat.tool.team.issueAnswerLive', 'Answering issues')
        : translate('components.native-chat.tool.team.issueAnswer', 'Answered {{count}} issues', {
            count,
            defaultValue_one: 'Answered {{count}} issue'
          })
    case 'seatPause':
      return live
        ? translate('components.native-chat.tool.team.seatPauseLive', 'Pausing seats')
        : translate('components.native-chat.tool.team.seatPause', 'Paused seats {{count}} times', {
            count,
            defaultValue_one: 'Paused seats'
          })
    case 'seatResume':
      return live
        ? translate('components.native-chat.tool.team.seatResumeLive', 'Resuming seats')
        : translate(
            'components.native-chat.tool.team.seatResume',
            'Resumed seats {{count}} times',
            {
              count,
              defaultValue_one: 'Resumed seats'
            }
          )
    case 'configRead':
      return live
        ? translate('components.native-chat.tool.team.configReadLive', 'Reading the team settings')
        : translate(
            'components.native-chat.tool.team.configRead',
            'Read the team settings {{count}} times',
            {
              count,
              defaultValue_one: 'Read the team settings'
            }
          )
    case 'seatUpdate':
      return live
        ? translate('components.native-chat.tool.team.seatUpdateLive', 'Changing seats')
        : translate(
            'components.native-chat.tool.team.seatUpdate',
            'Changed seats {{count}} times',
            {
              count,
              defaultValue_one: 'Changed seats'
            }
          )
    case 'roleUpdate':
      return live
        ? translate('components.native-chat.tool.team.roleUpdateLive', 'Changing roles')
        : translate(
            'components.native-chat.tool.team.roleUpdate',
            'Changed roles {{count}} times',
            {
              count,
              defaultValue_one: 'Changed roles'
            }
          )
    case 'projectUpdate':
      return live
        ? translate(
            'components.native-chat.tool.team.projectUpdateLive',
            'Changing project settings'
          )
        : translate(
            'components.native-chat.tool.team.projectUpdate',
            'Changed project settings {{count}} times',
            {
              count,
              defaultValue_one: 'Changed project settings'
            }
          )
    case 'teamUpdate':
      return live
        ? translate('components.native-chat.tool.team.teamUpdateLive', 'Changing teams')
        : translate(
            'components.native-chat.tool.team.teamUpdate',
            'Changed teams {{count}} times',
            {
              count,
              defaultValue_one: 'Changed teams'
            }
          )
    case 'report':
      return live
        ? translate('components.native-chat.tool.team.reportLive', 'Reporting')
        : translate('components.native-chat.tool.team.report', 'Reported {{count}} times', {
            count,
            defaultValue_one: 'Reported the step'
          })
    case 'other':
      return live
        ? translate('components.native-chat.tool.team.otherLive', 'Running team commands')
        : translate('components.native-chat.tool.team.other', 'Ran {{count}} team commands', {
            count,
            defaultValue_one: 'Ran {{count}} team command'
          })
  }
}
