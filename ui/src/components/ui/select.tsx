import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

/** The one select. Reuse for status/priority/agent/role controls. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-8 rounded-lg border border-line bg-[var(--theme-input)] px-2 text-sm text-fg outline-none transition-colors focus:border-accent',
      className,
    )}
    {...props}
  >
    {children}
  </select>
))
Select.displayName = 'Select'
