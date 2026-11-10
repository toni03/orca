import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import type { AgentTeamIssue } from '../../../../shared/agent-team/agent-team-types'

/** The issue text in a frame; GitHub and GitLab write Markdown, so it renders as such. */
export function TeamIssueDescription({ issue }: { issue: AgentTeamIssue }): React.JSX.Element {
  const body = issue.body.trim()
  const markdown = issue.tracker?.provider === 'github' || issue.tracker?.provider === 'gitlab'
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      {markdown ? (
        <CommentMarkdown
          variant="document"
          content={body}
          className="text-sm leading-relaxed text-foreground"
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm">{body}</p>
      )}
    </div>
  )
}
