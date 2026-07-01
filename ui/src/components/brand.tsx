import { cn } from '@/lib/cn'

// The Talaria wordmark — winged sandal mark + gradient wordmark.
export function Brand({ className, showTag = false }: { className?: string; showTag?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <WingMark className="h-8 w-8" />
      <div className="leading-tight">
        <div
          className="mercury-text text-xl font-semibold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Talaria
        </div>
        {showTag && (
          <div className="theme-muted text-[11px] tracking-wide">the winged fleet cockpit</div>
        )}
      </div>
    </div>
  )
}

// A small winged-sandal glyph rendered as gradient-stroked SVG.
export function WingMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id="mercuryWing" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b98f5a" />
          <stop offset="1" stopColor="#d0aa76" />
        </linearGradient>
      </defs>
      {/* sandal sole */}
      <path
        d="M6 22c4 2 10 3 16 1.5"
        stroke="url(#mercuryWing)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* wings */}
      <path
        d="M9 18c-2.5-1-5-1-6.5.5M11 14c-3-1.5-6.5-1.5-8.5.5M13 10c-3.5-1.5-7.5-1-9.5 1"
        stroke="url(#mercuryWing)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* spark */}
      <circle cx="23" cy="9" r="2.2" fill="url(#mercuryWing)" />
    </svg>
  )
}
