import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

/** The one text input. Reuse everywhere — do not re-style inputs inline. */
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-11 rounded-xl border border-line bg-[var(--theme-input)] px-3 text-fg outline-none transition-colors',
      'placeholder:text-muted placeholder:opacity-70 focus:border-accent',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'
