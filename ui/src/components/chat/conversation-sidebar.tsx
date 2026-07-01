import { cn } from '@/lib/cn'
import { Avatar } from '@/components/ui/avatar'
import type { AgentModel } from '@/lib/agents'
import type { Conversation } from '@/lib/conversations'

// Per-user chat lists, grouped by agent. Each agent shows its conversations and
// a "new chat" action; agents with no chats still appear so you can start one.
export function ConversationSidebar({
  agents,
  conversations,
  selectedConversationId,
  selectedAgent,
  onSelect,
  onNewChat,
}: {
  agents: AgentModel[]
  conversations: Conversation[]
  selectedConversationId: string | null
  selectedAgent: string | null
  onSelect: (conv: Conversation) => void
  onNewChat: (agentModel: string) => void
}) {
  return (
    <nav className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-line-subtle bg-sidebar">
      <div className="space-y-4 p-3">
        {agents.map((agent) => {
          const convs = conversations.filter((c) => c.agentModel === agent.id)
          const isActiveAgent = selectedAgent === agent.id
          return (
            <div key={agent.id}>
              <div className="mb-1 flex items-center gap-2 px-1">
                <Avatar name={agent.label} className="h-5 w-5" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted">
                  {agent.label}
                </span>
                <button
                  type="button"
                  onClick={() => onNewChat(agent.id)}
                  title={`New chat with ${agent.label}`}
                  className="text-muted transition-colors hover:text-accent"
                >
                  +
                </button>
              </div>

              {convs.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onNewChat(agent.id)}
                  className={cn(
                    'w-full truncate rounded-lg px-2 py-1.5 text-left text-sm text-muted transition-colors hover:bg-card',
                    isActiveAgent && !selectedConversationId && 'bg-card text-fg',
                  )}
                >
                  New chat…
                </button>
              ) : (
                <ul className="space-y-0.5">
                  {convs.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(c)}
                        className={cn(
                          'w-full truncate rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-card',
                          c.id === selectedConversationId ? 'bg-card text-fg' : 'text-muted',
                        )}
                      >
                        {c.title || 'Untitled'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
