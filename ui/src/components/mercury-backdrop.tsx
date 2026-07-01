import { motion } from 'framer-motion'

// A calm, matte backdrop in Mercury's own register: a faint HUD grid and two
// slow-drifting dust blooms in warm regolith tones (bronze + graphite). Low
// opacity, no neon — the planet is matte. Pure CSS + framer-motion (SSR-safe),
// sits behind everything.
export function MercuryBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-surface">
      {/* HUD grid */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(var(--theme-border) 1px, transparent 1px), linear-gradient(90deg, var(--theme-border) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          maskImage: 'radial-gradient(ellipse at 50% 30%, black 40%, transparent 85%)',
        }}
      />
      {/* Warm regolith bloom */}
      <motion.div
        className="absolute -top-40 -left-32 h-[36rem] w-[36rem] rounded-full blur-[130px]"
        style={{ background: 'radial-gradient(circle, rgba(185,143,90,0.10), transparent 70%)' }}
        animate={{ x: [0, 70, -20, 0], y: [0, 40, 90, 0] }}
        transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Cool slate bloom (Mercury's ray terrain) */}
      <motion.div
        className="absolute -bottom-48 -right-24 h-[40rem] w-[40rem] rounded-full blur-[140px]"
        style={{ background: 'radial-gradient(circle, rgba(140,150,170,0.07), transparent 70%)' }}
        animate={{ x: [0, -50, 30, 0], y: [0, -40, -10, 0] }}
        transition={{ duration: 40, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
