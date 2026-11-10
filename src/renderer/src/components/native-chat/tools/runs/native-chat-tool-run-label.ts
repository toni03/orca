import { translate } from '@/i18n/i18n'
import {
  nativeChatToolRunSentence as sharedRunSentence,
  type NativeChatToolRunSentenceWords
} from '../../../../../../shared/native-chat/tools/native-chat-tool-run-sentence'
import type { OrcaTeamCommandKind } from '../../../../../../shared/native-chat/tools/native-chat-orca-team-command'
import type { NativeChatToolCategory } from '../../../../../../shared/native-chat/tools/native-chat-tool-icon'
import type { NativeChatBlock } from '../../../../../../shared/native-chat/native-chat-types'

/** Extraction requires literal keys/fallbacks; parity tests keep these clauses aligned with mobile’s shared record. */
function clause(category: NativeChatToolCategory, count: number, live: boolean): string {
  const one = count === 1
  if (live) {
    return liveClause(category, count)
  }
  switch (category) {
    case 'read':
      return translate('components.native-chat.tool.runRead', 'Read {{count}} files', {
        count,
        defaultValue_one: 'Read {{count}} file'
      })
    case 'search':
      return translate('components.native-chat.tool.runSearch', 'Searched {{count}} times', {
        count,
        defaultValue_one: 'Searched {{count}} time'
      })
    case 'listFiles':
      return translate('components.native-chat.tool.runListFiles', 'Listed {{count}} directories', {
        count,
        defaultValue_one: 'Listed {{count}} directory'
      })
    case 'unknown':
      return translate('components.native-chat.tool.runCommand', 'Ran {{count}} commands', {
        count,
        defaultValue_one: 'Ran {{count}} command'
      })
    case 'fileChange':
      return translate('components.native-chat.tool.runFileChange', 'Edited {{count}} files', {
        count,
        defaultValue_one: 'Edited {{count}} file'
      })
    case 'webSearch':
      return translate(
        'components.native-chat.tool.runWebSearch',
        'Searched the web {{count}} times',
        { count, defaultValue_one: 'Searched the web {{count}} time' }
      )
    case 'browser':
      return one
        ? translate('components.native-chat.tool.runBrowserOne', 'Used the browser')
        : translate('components.native-chat.tool.runBrowser', 'Used the browser {{count}} times', {
            count,
            defaultValue_one: 'Used the browser {{count}} time'
          })
    case 'mcpToolCall':
      return translate(
        'components.native-chat.tool.runIntegration',
        'Used {{count}} integrations',
        { count, defaultValue_one: 'Used {{count}} integration' }
      )
    case 'subAgentActivity':
      return translate('components.native-chat.tool.runAgent', 'Ran {{count}} agents', {
        count,
        defaultValue_one: 'Ran {{count}} agent'
      })
    case 'todoList':
      return one
        ? translate('components.native-chat.tool.runPlanOne', 'Updated the plan')
        : translate('components.native-chat.tool.runPlan', 'Updated the plan {{count}} times', {
            count,
            defaultValue_one: 'Updated the plan {{count}} time'
          })
    case 'other':
      return translate('components.native-chat.tool.runTool', 'Used {{count}} tools', {
        count,
        defaultValue_one: 'Used {{count}} tool'
      })
  }
}

function liveClause(category: NativeChatToolCategory, count: number): string {
  const one = count === 1
  switch (category) {
    case 'read':
      return translate('components.native-chat.tool.runLiveRead', 'Reading {{count}} files', {
        count,
        defaultValue_one: 'Reading {{count}} file'
      })
    case 'search':
      return translate('components.native-chat.tool.runLiveSearch', 'Searching {{count}} times', {
        count,
        defaultValue_one: 'Searching {{count}} time'
      })
    case 'listFiles':
      return translate(
        'components.native-chat.tool.runLiveListFiles',
        'Listing {{count}} directories',
        { count, defaultValue_one: 'Listing {{count}} directory' }
      )
    case 'unknown':
      return translate('components.native-chat.tool.runLiveCommand', 'Running {{count}} commands', {
        count,
        defaultValue_one: 'Running {{count}} command'
      })
    case 'fileChange':
      return translate('components.native-chat.tool.runLiveFileChange', 'Editing {{count}} files', {
        count,
        defaultValue_one: 'Editing {{count}} file'
      })
    case 'webSearch':
      return translate(
        'components.native-chat.tool.runLiveWebSearch',
        'Searching the web {{count}} times',
        { count, defaultValue_one: 'Searching the web {{count}} time' }
      )
    case 'browser':
      return one
        ? translate('components.native-chat.tool.runLiveBrowserOne', 'Using the browser')
        : translate(
            'components.native-chat.tool.runLiveBrowser',
            'Using the browser {{count}} times',
            { count, defaultValue_one: 'Using the browser {{count}} time' }
          )
    case 'mcpToolCall':
      return translate(
        'components.native-chat.tool.runLiveIntegration',
        'Using {{count}} integrations',
        { count, defaultValue_one: 'Using {{count}} integration' }
      )
    case 'subAgentActivity':
      return translate('components.native-chat.tool.runLiveAgent', 'Running {{count}} agents', {
        count,
        defaultValue_one: 'Running {{count}} agent'
      })
    case 'todoList':
      return one
        ? translate('components.native-chat.tool.runLivePlanOne', 'Updating the plan')
        : translate(
            'components.native-chat.tool.runLivePlan',
            'Updating the plan {{count}} times',
            { count, defaultValue_one: 'Updating the plan {{count}} time' }
          )
    case 'other':
      return translate('components.native-chat.tool.runLiveTool', 'Using {{count}} tools', {
        count,
        defaultValue_one: 'Using {{count}} tool'
      })
  }
}

/** Agent team CLI calls by what they did; keys stay literal for extraction. */
function teamClause(kind: OrcaTeamCommandKind, count: number, live: boolean): string {
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

const LOCALIZED_WORDS: NativeChatToolRunSentenceWords = {
  clause,
  teamClause,
  pair: (first, second) =>
    translate('components.native-chat.tool.runPair', '{{value0}} and {{value1}}', {
      value0: first,
      value1: second
    }),
  list: (leading, last) =>
    translate('components.native-chat.tool.runList', '{{value0}}, and {{value1}}', {
      value0: leading.join(translate('components.native-chat.tool.runListSeparator', ', ')),
      value1: last
    })
}

export function nativeChatToolRunSentence(
  blocks: readonly NativeChatBlock[],
  { live = false }: { live?: boolean } = {}
): string | null {
  return sharedRunSentence(blocks, { live }, LOCALIZED_WORDS)
}
