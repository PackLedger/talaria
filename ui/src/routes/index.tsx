import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Brand } from '@/components/brand'
import { MercuryBackdrop } from '@/components/mercury-backdrop'
import { ThemeToggle } from '@/components/theme-toggle'
import { ChatView } from '@/components/chat/chat-view'
import { ConversationSidebar } from '@/components/chat/conversation-sidebar'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAgents } from '@/lib/agents'
import { useConversations, type Conversation } from '@/lib/conversations'
import { useLogout, useSession } from '@/lib/session'

export const Route = createFileRoute('/')({
  component: Cockpit,
})

function Cockpit() {
  const { data: user, isLoading, isSuccess } = useSession()
  const navigate = useNavigate()
  const logout = useLogout()
  const qc = useQueryClient()

  const { data: fleet, isLoading: agentsLoading } = useAgents()
  const agents = useMemo(() => fleet?.agents ?? [], [fleet])
  const { data: conversations = [] } = useConversations()

  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [newChatSignal, setNewChatSignal] = useState(0)

  useEffect(() => {
    if (!selectedAgent && agents[0]) setSelectedAgent(agents[0].id)
  }, [agents, selectedAgent])

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

  const selectConversation = (c: Conversation) => {
    setSelectedAgent(c.agentModel)
    setSelectedConversationId(c.id)
  }
  const newChat = (agentModel: string) => {
    setSelectedAgent(agentModel)
    setSelectedConversationId(null)
    setNewChatSignal((n) => n + 1)
  }
  const onCreated = (id: string) => {
    setSelectedConversationId(id)
    void qc.invalidateQueries({ queryKey: ['conversations'] })
  }

  const current = agents.find((a) => a.id === selectedAgent)

  return (
    <>
      <MercuryBackdrop />
      <div className="flex h-screen flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line-subtle px-6 py-3 backdrop-blur">
          <Brand />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3">
              <Avatar src={user.picture} name={user.name ?? user.email} />
              <span className="hidden max-w-[12rem] truncate text-sm text-fg sm:block">
                {user.name ?? user.email}
              </span>
              {user.role === 'admin' && <span className="text-xs text-accent">admin</span>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <ConversationSidebar
            agents={agents}
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            selectedAgent={selectedAgent}
            onSelect={selectConversation}
            onNewChat={newChat}
          />

          <main className="min-h-0 flex-1">
            {selectedAgent && current ? (
              <ChatView
                key={selectedAgent}
                agentModel={selectedAgent}
                agentLabel={current.label}
                conversationId={selectedConversationId}
                newChatSignal={newChatSignal}
                onCreated={onCreated}
              />
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted">
                {agentsLoading ? 'Loading the fleet…' : 'No agents available.'}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}
