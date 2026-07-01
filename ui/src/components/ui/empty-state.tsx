import type { ReactNode } from 'react'

// The one empty/zero state. Centered mark + short line + optional single action.
// Reuse for every no-data view — don't hand-roll bare "No X yet" strings.
export function EmptyState({
  icon = '◇',
  title,
  hint,
  action,
}: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div className="max-w-xs">
        <div className="mercury-text mx-auto mb-3 text-3xl">{icon}</div>
        <div className="text-sm font-medium text-fg">{title}</div>
        {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}
