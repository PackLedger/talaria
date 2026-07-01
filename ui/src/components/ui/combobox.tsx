import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'

export interface ComboOption {
  value: string
  label: string
  sub?: string
}

// Subsequence fuzzy match: chars of `q` appear in order in `text`.
function fuzzy(q: string, text: string): boolean {
  if (!q) return true
  const s = text.toLowerCase()
  let i = 0
  for (const ch of q.toLowerCase()) {
    i = s.indexOf(ch, i)
    if (i === -1) return false
    i++
  }
  return true
}

// A searchable dropdown for picking option(s). Fuzzy filter as you type.
// Single mode: selecting closes + reports the value. Multi: toggles, stays open.
export function Combobox({
  options,
  selected,
  onChange,
  multiple = false,
  placeholder = 'Select…',
  disabled,
  className,
}: {
  options: ComboOption[]
  selected: string[]
  onChange: (next: string[]) => void
  multiple?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const filtered = useMemo(() => options.filter((o) => fuzzy(q, o.label + ' ' + (o.sub ?? ''))), [options, q])
  const selectedSet = new Set(selected)
  const byValue = (v: string) => options.find((o) => o.value === v)

  const toggle = (v: string) => {
    if (multiple) onChange(selectedSet.has(v) ? selected.filter((x) => x !== v) : [...selected, v])
    else {
      onChange([v])
      setOpen(false)
    }
  }

  const triggerLabel = () => {
    if (selected.length === 0) return <span className="text-muted">{placeholder}</span>
    if (!multiple) return <span className="truncate text-fg">{byValue(selected[0]!)?.label ?? selected[0]}</span>
    const labels = selected.map((v) => byValue(v)?.label ?? v)
    return (
      <span className="truncate text-fg">
        {labels.slice(0, 2).join(', ')}
        {labels.length > 2 ? ` +${labels.length - 2}` : ''}
      </span>
    )
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-[var(--theme-input)] px-2 text-sm outline-none transition-colors hover:border-[var(--theme-accent-border)] disabled:opacity-50"
      >
        <span className="min-w-0 flex-1 text-left">{triggerLabel()}</span>
        <span className="text-muted">▾</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            className="mercury-panel absolute left-0 z-30 mt-1 w-full overflow-hidden rounded-xl"
          >
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="w-full border-b border-line-subtle bg-transparent px-3 py-2 text-sm text-fg outline-none placeholder:text-muted"
            />
            <ul className="max-h-56 overflow-y-auto p-1">
              {filtered.length === 0 && <li className="px-2 py-2 text-xs text-muted">No matches</li>}
              {filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => toggle(o.value)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-card2',
                      selectedSet.has(o.value) && 'bg-card2',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-fg">{o.label}</span>
                      {o.sub && <span className="block truncate text-xs text-muted">{o.sub}</span>}
                    </span>
                    {selectedSet.has(o.value) && <span className="text-accent">✓</span>}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
