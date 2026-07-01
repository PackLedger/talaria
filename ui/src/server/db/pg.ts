// Postgres — durable state (users, roles, per-agent access, conversations,
// messages). postgres.js (no native build). Migrations run once, lazily, on
// first query. Cached on globalThis so HMR doesn't open a new pool each reload.

import postgres from 'postgres'

type Sql = ReturnType<typeof postgres>
const g = globalThis as unknown as { __talariaSql?: Sql; __talariaMigrated?: Promise<void> }

export function getSql(): Sql {
  if (!g.__talariaSql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    g.__talariaSql = postgres(url, { max: 10, idle_timeout: 20, onnotice: () => {} })
  }
  return g.__talariaSql
}

// One statement per entry (postgres.js extended protocol is one-statement).
const MIGRATIONS: string[] = [
  `create table if not exists users (
     id uuid primary key default gen_random_uuid(),
     sub text unique not null,
     email text,
     name text,
     picture text,
     role text not null default 'member',
     created_at timestamptz not null default now(),
     last_seen_at timestamptz not null default now()
   )`,
  `create table if not exists user_agent_access (
     user_id uuid not null references users(id) on delete cascade,
     agent_model text not null,
     primary key (user_id, agent_model)
   )`,
  `create table if not exists conversations (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references users(id) on delete cascade,
     agent_model text not null,
     title text,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now(),
     archived boolean not null default false
   )`,
  `create index if not exists conversations_user_agent_idx
     on conversations(user_id, agent_model, updated_at desc)`,
  `create table if not exists messages (
     id uuid primary key default gen_random_uuid(),
     conversation_id uuid not null references conversations(id) on delete cascade,
     seq integer not null,
     role text not null,
     content text not null default '',
     reasoning text not null default '',
     tools jsonb not null default '[]',
     status text not null default 'complete',
     created_at timestamptz not null default now(),
     unique (conversation_id, seq)
   )`,
  `create index if not exists messages_conv_idx on messages(conversation_id, seq)`,
  // Fleet agent registry — Talaria's own "brain" (ripped from mission-control's
  // agents table). Agents register + heartbeat to Talaria, not MC.
  `create table if not exists fleet_agents (
     id uuid primary key default gen_random_uuid(),
     name text unique not null,
     role text not null default 'agent',
     status text not null default 'offline',
     last_seen timestamptz,
     last_activity text,
     framework text,
     capabilities jsonb not null default '[]',
     config jsonb not null default '{}',
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  // Boards — user-owned kanban boards, shareable across the team.
  `create table if not exists boards (
     id uuid primary key default gen_random_uuid(),
     name text not null,
     owner_id uuid not null references users(id) on delete cascade,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  // Membership = sharing. role: owner | editor | viewer.
  `create table if not exists board_members (
     board_id uuid not null references boards(id) on delete cascade,
     user_id uuid not null references users(id) on delete cascade,
     role text not null default 'editor',
     created_at timestamptz not null default now(),
     primary key (board_id, user_id)
   )`,
  // Task queue — Talaria's own (ripped from mission-control's tasks), scoped to a board.
  `create table if not exists tasks (
     id uuid primary key default gen_random_uuid(),
     board_id uuid not null references boards(id) on delete cascade,
     title text not null,
     description text,
     status text not null default 'inbox',
     priority text not null default 'medium',
     assigned_to text,
     created_by text not null default 'user',
     result text,
     tags jsonb not null default '[]',
     metadata jsonb not null default '{}',
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create index if not exists tasks_board_idx on tasks(board_id, status, updated_at desc)`,
  `create index if not exists tasks_assignee_idx on tasks(assigned_to)`,
]

function ensureMigrated(): Promise<void> {
  if (!g.__talariaMigrated) {
    const sql = getSql()
    g.__talariaMigrated = (async () => {
      for (const stmt of MIGRATIONS) await sql.unsafe(stmt)
    })()
  }
  return g.__talariaMigrated
}

/** Migrated Postgres handle. `const sql = await db()`. */
export async function db(): Promise<Sql> {
  await ensureMigrated()
  return getSql()
}
