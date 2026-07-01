import { cn } from '@/lib/cn'

export type PanelProps = React.HTMLAttributes<HTMLDivElement>

/** The core matte-glass surface. Reuse for cards/dialogs — don't re-style. */
export function Panel({ className, ...props }: PanelProps) {
  return <div className={cn('mercury-panel rounded-2xl', className)} {...props} />
}
