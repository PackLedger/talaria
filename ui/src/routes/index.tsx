import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Brand } from '@/components/brand'
import { MercuryBackdrop } from '@/components/mercury-backdrop'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
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
        <div className="grid min-h-screen place-items-center text-sm text-muted">Loading…</div>
      </>
    )
  }

  return (
    <>
      <MercuryBackdrop />
      <div className="flex min-h-screen flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-line-subtle px-6 py-3 backdrop-blur">
          <Brand />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3">
              <Avatar src={user.picture} name={user.name ?? user.email} />
              <span className="max-w-[12rem] truncate text-sm text-fg">{user.name ?? user.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </header>

        {/* Placeholder cockpit — the P2.1 agent picker + streaming chat land here. */}
        <main className="flex flex-1 items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Panel className="max-w-lg p-8 text-center">
              <h1 className="mercury-text mb-2 text-2xl font-semibold">
                Welcome aboard, {(user.name ?? user.email ?? 'pilot').split(' ')[0]}.
              </h1>
              <p className="text-sm text-muted">
                You’re signed in via <span className="text-accent">{user.provider}</span>. The agent
                picker and streaming chat cockpit (P2.1) plug in here next.
              </p>
            </Panel>
          </motion.div>
        </main>
      </div>
    </>
  )
}
