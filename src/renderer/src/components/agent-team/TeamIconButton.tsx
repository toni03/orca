import type React from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type Props = Omit<React.ComponentProps<typeof Button>, 'aria-label' | 'children'> & {
  label: string
  children: React.ReactNode
}

/** Icon-only button whose label is both its accessible name and its tooltip. */
export function TeamIconButton({
  label,
  children,
  variant = 'ghost',
  size = 'icon-xs',
  ...props
}: Props): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant} size={size} aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** Icon-only external link with the same tooltip. */
export function TeamIconLink({
  label,
  href,
  children,
  className
}: {
  label: string
  href: string
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a href={href} target="_blank" rel="noreferrer" aria-label={label} className={className}>
          {children}
        </a>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
