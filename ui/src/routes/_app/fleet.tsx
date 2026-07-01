import { createFileRoute } from '@tanstack/react-router'
import { StatCard } from '@/components/ui/stat-card'
import { Panel } from '@/components/ui/panel'
import { Avatar } from '@/components/ui/avatar'
import { useFleet, relativeTime } from '@/lib/fleet'

export const Route = createFileRoute('/_app/fleet')({
  component: FleetOverview,
})

function FleetOverview() {
  const { data, isLoading } = useFleet()
  const agents = data?.agents ?? []
  const t = data?.totals
  const busiest = [...agents].sort((a, b) => b.messages - a.messages)[0]

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="mercury-text text-2xl font-semibold">Fleet overview</h1>
          <p className="text-sm text-muted">Talaria-native usage across the fleet.</p>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted">Loading fleet…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Agents" value={t?.agents ?? 0} sub="in the fleet" />
              <StatCard label="Active today" value={t?.activeToday ?? 0} sub="used in 24h" />
              <StatCard label="Conversations" value={t?.conversations ?? 0} sub="all time" />
              <StatCard label="Messages" value={t?.messages ?? 0} sub="all time" />
            </div>

            <Panel className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-fg">Agents by activity</h2>
                {busiest && busiest.messages > 0 && (
                  <span className="text-xs text-muted">
                    busiest: <span className="text-accent">{busiest.label}</span>
                  </span>
                )}
              </div>
              <ul className="divide-y divide-line-subtle">
                {agents.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2">
                    <Avatar name={a.label} className="h-6 w-6" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-fg">{a.label}</span>
                      <span className="block truncate text-xs text-muted">{a.role}</span>
                    </span>
                    <span className="text-xs text-muted">{a.conversations} chats</span>
                    <span className="w-16 text-right text-xs text-muted">{a.messages} msgs</span>
                    <span className="w-20 text-right text-xs text-muted">{relativeTime(a.lastUsed)}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <p className="text-xs text-muted">
              Owned by Talaria (gateway fleet + our Postgres). Live status, task queue, and cost/tokens
              land here as we rip the brain in — agents will report to Talaria, not mission-control.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
