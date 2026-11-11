import { cn } from '@/lib/class-names'
import type { Repo } from '../../../../shared/repo-types'

/** Project colour square with its initial, the same colour the sidebar uses for the repo. */
export function TeamProjectAvatar({
  repo,
  name,
  className
}: {
  repo: Repo | undefined
  name: string
  className?: string
}): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted-foreground text-[10px] font-bold uppercase text-background',
        className
      )}
      style={repo?.badgeColor ? { backgroundColor: repo.badgeColor, color: '#fff' } : undefined}
    >
      {name.trim().charAt(0) || '?'}
    </span>
  )
}
