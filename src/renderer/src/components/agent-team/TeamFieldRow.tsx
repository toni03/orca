import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** One settings row: label and hint on the left, the control on the right; stacks when narrow. */
export function TeamFieldRow({
  id,
  label,
  hint,
  error,
  children
}: {
  id: string
  label: string
  hint?: React.ReactNode
  error?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-3.5 py-3 first:border-t-0">
      <div className="flex min-w-48 flex-1 flex-col gap-0.5">
        <Label id={`${id}-label`} htmlFor={id}>
          {label}
        </Label>
        {hint ? (
          <span className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
            {hint}
          </span>
        ) : null}
      </div>
      <div className="flex w-64 max-w-full shrink-0 justify-end">{children}</div>
    </div>
  )
}
