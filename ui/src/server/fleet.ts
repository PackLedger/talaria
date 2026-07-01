// Fleet ops data — OWNED by Talaria (not proxied from mission-control). The agent
// list comes from the gateway plane (/v1/models); usage comes from Talaria's own
// Postgres (conversations + messages). As we rip more of the "brain" in (agent
// registry/heartbeat, task queue, token ledger — agents reporting to Talaria),
// this grows from usage stats into full fleet telemetry.

import { db } from './db/pg'
import { listAgents } from './gateway'

export interface FleetAgentStat {
  id: string
  label: string
  role: string
  conversations: number
  messages: number
  lastUsed: string | null
}

export interface FleetOverview {
  agents: FleetAgentStat[]
  source: 'gateway' | 'mock'
  totals: { agents: number; conversations: number; messages: number; activeToday: number }
}

export async function getFleetOverview(): Promise<FleetOverview> {
  const { agents, source } = await listAgents()
  const sql = await db()

  // Fleet-wide usage (all users) per agent — the ops/maintainer view.
  const rows = await sql`
    select c.agent_model as model,
           count(distinct c.id)::int as conversations,
           count(m.id)::int as messages,
           max(c.updated_at) as last_used
    from conversations c
    left join messages m on m.conversation_id = c.id
    group by c.agent_model
  `
  const byModel = new Map(rows.map((r) => [r.model as string, r]))

  const stats: FleetAgentStat[] = agents.map((a) => {
    const r = byModel.get(a.id) as { conversations: number; messages: number; last_used: string | null } | undefined
    return {
      id: a.id,
      label: a.label,
      role: a.role,
      conversations: r?.conversations ?? 0,
      messages: r?.messages ?? 0,
      lastUsed: r?.last_used ?? null,
    }
  })

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const totals = {
    agents: stats.length,
    conversations: stats.reduce((n, s) => n + s.conversations, 0),
    messages: stats.reduce((n, s) => n + s.messages, 0),
    activeToday: stats.filter((s) => s.lastUsed && new Date(s.lastUsed).getTime() > dayAgo).length,
  }

  return { agents: stats, source, totals }
}
