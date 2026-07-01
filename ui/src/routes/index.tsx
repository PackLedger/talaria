import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Brand } from '@/components/brand'
import { MercuryBackdrop } from '@/components/mercury-backdrop'
import { ThemeToggle } from '@/components/theme-toggle'
import { useLogout, useSession } from '@/lib/session'

export const Route = createFileRoute('/')({
  component: Cockpit,
})

function Cockpit() {
  const { data: user, isLoading, isSuccess } = useSession()
  const navigate = useNavigate()
  const logout = useLogout()

  // Gate: no session → login.
  useEffect(() => {
    if (isSuccess && !user) void navigate({ to: '/login' })
  }, [isSuccess, user, navigate])

  if (isLoading || !user) {
    return (
      <>
        <MercuryBackdrop />
        <div className="theme-muted grid min-h-screen place-items-center text-sm">Loading…</div>
      </>
    )
  }

  return (
    <>
      <MercuryBackdrop />
      <div className="flex min-h-screen flex-col">
        {/* Top bar */}
        <header className="theme-border-subtle flex items-center justify-between border-b px-6 py-3 backdrop-blur">
          <Brand />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="theme-card theme-border flex items-center gap-2 rounded-full border py-1 pl-1 pr-3">
              {user.picture ? (
                <img src={user.picture} alt="" className="h-7 w-7 rounded-full" />
              ) : (
                <span className="mercury-gradient grid h-7 w-7 place-items-center rounded-full text-sm font-semibold text-white">
                  {(user.name ?? user.email ?? '?').charAt(0).toUpperCase()}
                </span>
              )}
              <span className="theme-text max-w-[12rem] truncate text-sm">
                {user.name ?? user.email}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="theme-muted text-sm transition-colors hover:text-[var(--theme-accent)]"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Placeholder cockpit — the P2.1 agent picker + streaming chat land here. */}
        <main className="flex flex-1 items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mercury-panel max-w-lg rounded-2xl p-8 text-center"
          >
            <h1
              className="mercury-text mb-2 text-2xl font-semibold"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Welcome aboard, {(user.name ?? user.email ?? 'pilot').split(' ')[0]}.
            </h1>
            <p className="theme-muted text-sm">
              You’re signed in via <span className="theme-accent">{user.provider}</span>. The agent
              picker and streaming chat cockpit (P2.1) plug in here next.
            </p>
          </motion.div>
        </main>
      </div>
    </>
  )
}
