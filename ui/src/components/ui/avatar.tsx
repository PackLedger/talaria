import { cn } from '@/lib/cn'

export interface AvatarProps {
  src?: string | null
  name?: string | null
  className?: string
}

/** Avatar with a bronze fallback monogram. Reuse for user/agent avatars. */
export function Avatar({ src, name, className }: AvatarProps) {
  const cls = cn('h-7 w-7 rounded-full', className)
  if (src) return <img src={src} alt="" className={cls} />
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <span className={cn(cls, 'mercury-gradient grid place-items-center text-sm font-semibold text-surface')}>
      {initial}
    </span>
  )
}
