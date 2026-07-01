import { motion } from 'framer-motion'

// A calm, futuristic backdrop: two slow-drifting violet/magenta plasma blooms
// over a faint HUD grid. Pure CSS + framer-motion (no WebGL) so it's cheap and
// SSR-safe. Sits behind everything (fixed, pointer-events-none).
export function MercuryBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden theme-bg">
      {/* HUD grid */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(var(--theme-border) 1px, transparent 1px), linear-gradient(90deg, var(--theme-border) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at 50% 30%, black 40%, transparent 85%)',
        }}
      />
      {/* Plasma bloom A */}
      <motion.div
        className="absolute -top-40 -left-32 h-[36rem] w-[36rem] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.28), transparent 70%)' }}
        animate={{ x: [0, 80, -20, 0], y: [0, 40, 90, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Plasma bloom B */}
      <motion.div
        className="absolute -bottom-48 -right-24 h-[40rem] w-[40rem] rounded-full blur-[130px]"
        style={{ background: 'radial-gradient(circle, rgba(192,38,211,0.22), transparent 70%)' }}
        animate={{ x: [0, -60, 30, 0], y: [0, -50, -10, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
