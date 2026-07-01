import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Brand } from '@/components/brand'
import { MercuryBackdrop } from '@/components/mercury-backdrop'
import { ThemeToggle } from '@/components/theme-toggle'
import { AgentPicker } from '@/components/chat/agent-picker'
import { ChatView } from '@/components/chat/chat-view'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAgents } from '@/lib/agents'
import { useLogout, useSession } from '@/lib/session'

export const Route = createFileRoute('/')({
  component: Cockpit,
})

function Cockpit() {
  const { data: user, isLoading, isSuccess } = useSession()
  const navigate = useNavigate()
  const logout = useLogout()

  const { data: fleet, isLoading: agentsLoading } = useAgents()
  const agents = useMemo(() => fleet?.agents ?? [], [fleet])
  const [selected, setSelected] = useState<string | null>(null)

  // Default to the first agent once the fleet loads.
  useEffect(() => {
    if (!selected && agents[0]) setSelected(agents[0].id)
  }, [agents, selected])

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

  const current = agents.find((a) => a.id === selected)

  return (
    <>
      <MercuryBackdrop />
      <div className="flex h-screen flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 border-b border-line-subtle px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-4">
            <Brand />
            <AgentPicker agents={agents} value={selected} onChange={setSelected} loading={agentsLoading} />
            {fleet?.source === 'mock' && (
              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">mock</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3">
              <Avatar src={user.picture} name={user.name ?? user.email} />
              <span className="hidden max-w-[12rem] truncate text-sm text-fg sm:block">
                {user.name ?? user.email}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </header>

        {/* Chat cockpit */}
        <main className="min-h-0 flex-1">
          {selected && current ? (
            <ChatView key={selected} model={selected} agentLabel={current.label} />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted">
              {agentsLoading ? 'Loading the fleet…' : 'No agents available.'}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
