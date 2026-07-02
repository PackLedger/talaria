import { useState } from 'react'
import { Link2, Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Copies an absolute link to `path` (origin resolved at click time, SSR-safe).
 *  Stops propagation so it never triggers the surrounding card/row click. Pass a
 *  `label` for a text button; omit for an icon-only affordance (e.g. hover on cards). */
export function CopyLinkButton({
  path,
  label,
  className,
  title = 'Copy link',
}: {
  path: string
  label?: string
  className?: string
  title?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void navigator.clipboard?.writeText(window.location.origin + path)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      className={cn('flex items-center gap-1 rounded-md p-1 text-muted transition-colors hover:bg-card hover:text-fg', className)}
    >
      {copied ? <Check size={13} /> : <Link2 size={13} />}
      {label && <span>{copied ? 'Copied' : label}</span>}
    </button>
  )
}
