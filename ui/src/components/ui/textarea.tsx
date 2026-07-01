import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

/** The one textarea. Reuse everywhere — do not re-style textareas inline. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full resize-none rounded-xl border border-line bg-[var(--theme-input)] px-3 py-2.5 text-fg outline-none transition-colors',
      'placeholder:text-muted placeholder:opacity-70 focus:border-accent',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'
