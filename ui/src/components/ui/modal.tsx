import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'

// The one modal. Centered panel over a scrim; Esc + backdrop-click close.
// Reuse for sharing, create dialogs, confirmations.
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className={`mercury-panel relative z-10 w-full ${width} rounded-2xl`}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-line-subtle px-5 py-3">
                <div className="text-sm font-semibold text-fg">{title}</div>
                <button onClick={onClose} className="text-muted hover:text-fg" aria-label="Close">
                  ✕
                </button>
              </div>
            )}
            <div className="p-5">{children}</div>
            {footer && <div className="border-t border-line-subtle px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
