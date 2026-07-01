// Fleet agent registry — Talaria owns this (ripped from mission-control). Agents
// register once and heartbeat to keep last_seen fresh; status is derived from
// heartbeat recency so a crashed agent reads offline.
import { db } from './db/pg'

export type AgentStatus = 'offline' | 'idle' | 'busy' | 'error'

export interface RegistryAgent {
  id: string
  name: string
  role: string
  status: AgentStatus
  lastSeen: string | null
  lastActivity: string | null
  framework: string | null
}

// Heartbeat freshness: seen within this window ⇒ live; else offline.
export const FRESH_MS = 90_000

export interface RegisterInput {
  name: string
  role?: string
  capabilities?: string[]
  framework?: string
}

/** POST /api/agents/register — upsert by name, mark idle + seen. Returns id. */
export async function registerAgent(input: RegisterInput): Promise<{ id: string; name: string }> {
  const sql = await db()
  const rows = await sql`
    insert into fleet_agents (name, role, framework, capabilities, status, last_seen, last_activity)
    values (${input.name}, ${input.role ?? 'agent'}, ${input.framework ?? null},
            ${sql.json((input.capabilities ?? []) as unknown as Parameters<typeof sql.json>[0])},
            'idle', now(), 'Registered')
    on conflict (name) do update set
      role = excluded.role,
      framework = excluded.framework,
      capabilities = excluded.capabilities,
      status = 'idle',
      last_seen = now(),
      last_activity = 'Registered',
      updated_at = now()
    returning id, name
  `
  return rows[0] as { id: string; name: string }
}

/** Heartbeat by registry id — refresh last_seen; lift offline → idle. Returns the
 *  agent's name (for assigned-work lookup) or null if unknown. */
export async function heartbeatAgent(id: string, activity?: string): Promise<string | null> {
  const sql = await db()
  const rows = await sql`
    update fleet_agents set
      last_seen = now(),
      status = case when status = 'offline' then 'idle' else status end,
      last_activity = coalesce(${activity ?? null}, last_activity),
      updated_at = now()
    where id = ${id}
    returning name
  `
  return rows.length ? (rows[0] as { name: string }).name : null
}

/** Seed fleet names (from /v1/models) so agents appear before they heartbeat. */
export async function seedFleetNames(names: string[]): Promise<void> {
  if (names.length === 0) return
  const sql = await db()
  for (const name of names) {
    await sql`insert into fleet_agents (name) values (${name}) on conflict (name) do nothing`
  }
}

/** Registry keyed by name, with status derived from heartbeat recency. */
export async function registryByName(): Promise<Map<string, RegistryAgent>> {
  const sql = await db()
  const rows = await sql`
    select id, name, role, status, last_seen as "lastSeen", last_activity as "lastActivity", framework
    from fleet_agents
  `
  const now = Date.now()
  const map = new Map<string, RegistryAgent>()
  for (const r of rows as unknown as RegistryAgent[]) {
    const fresh = r.lastSeen ? now - new Date(r.lastSeen).getTime() < FRESH_MS : false
    map.set(r.name, { ...r, status: fresh ? (r.status === 'offline' ? 'idle' : r.status) : 'offline' })
  }
  return map
}
