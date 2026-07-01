import { createFileRoute } from '@tanstack/react-router'
import { Panel } from '@/components/ui/panel'
import { Avatar } from '@/components/ui/avatar'
import { useFleet, relativeTime, STATUS_COLOR } from '@/lib/fleet'

export const Route = createFileRoute('/_app/agents')({
  component: AgentsRoster,
})

function AgentsRoster() {
  const { data, isLoading } = useFleet()
  const agents = data?.agents ?? []

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="mercury-text text-2xl font-semibold">Agents</h1>
          <p className="text-sm text-muted">The fleet roster and how each agent is used through Talaria.</p>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted">Loading agents…</div>
        ) : (
          <Panel className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-card2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Agent</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Last seen</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Conversations</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Messages</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Last used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {agents.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-card">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={a.label} className="h-7 w-7" />
                        <div className="min-w-0">
                          <div className="truncate text-fg">{a.label}</div>
                          <div className="truncate text-xs text-muted">{a.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[a.status] }} />
                        <span className="text-muted">{a.status}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{relativeTime(a.lastSeen)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-fg">{a.conversations}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-fg">{a.messages}</td>
                    <td className="px-4 py-2.5 text-right text-muted">{relativeTime(a.lastUsed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        <p className="text-xs text-muted">
          Status + last-seen come from Talaria's own agent registry (agents register + heartbeat to
          Talaria). Next rip: task queue (counts) and the token/cost ledger.
        </p>
      </div>
    </div>
  )
}
