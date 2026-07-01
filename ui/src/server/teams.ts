// Teams — a group of users that collectively own/access boards.
import { db } from './db/pg'

export type TeamRole = 'owner' | 'member'

export interface Team {
  id: string
  name: string
  role: TeamRole
  memberCount: number
  createdAt: string
}

export interface TeamMember {
  userId: string
  email: string | null
  name: string | null
  role: TeamRole
}

export async function listTeams(userId: string): Promise<Team[]> {
  const sql = await db()
  const rows = await sql`
    select t.id, t.name, m.role, t.created_at as "createdAt",
           (select count(*)::int from team_members x where x.team_id = t.id) as "memberCount"
    from teams t join team_members m on m.team_id = t.id and m.user_id = ${userId}
    order by t.name asc
  `
  return rows as unknown as Team[]
}

export async function userTeamIds(userId: string): Promise<string[]> {
  const sql = await db()
  const rows = await sql`select team_id from team_members where user_id = ${userId}`
  return (rows as unknown as Array<{ team_id: string }>).map((r) => r.team_id)
}

export async function teamRole(userId: string, teamId: string): Promise<TeamRole | null> {
  const sql = await db()
  const rows = await sql`select role from team_members where team_id = ${teamId} and user_id = ${userId}`
  return rows.length ? (rows[0] as { role: TeamRole }).role : null
}

export async function createTeam(userId: string, name: string): Promise<Team> {
  const sql = await db()
  const team = await sql.begin(async (tx) => {
    const rows = await tx`insert into teams (name, created_by) values (${name}, ${userId}) returning id, name, created_at as "createdAt"`
    const t = rows[0] as { id: string; name: string; createdAt: string }
    await tx`insert into team_members (team_id, user_id, role) values (${t.id}, ${userId}, 'owner')`
    return t
  })
  return { ...team, role: 'owner', memberCount: 1 }
}

export async function renameTeam(teamId: string, name: string): Promise<void> {
  const sql = await db()
  await sql`update teams set name = ${name} where id = ${teamId}`
}

export async function deleteTeam(teamId: string): Promise<void> {
  const sql = await db()
  await sql`delete from teams where id = ${teamId}`
}

export async function listTeamMembers(teamId: string): Promise<TeamMember[]> {
  const sql = await db()
  const rows = await sql`
    select m.user_id as "userId", u.email, u.name, m.role
    from team_members m join users u on u.id = m.user_id
    where m.team_id = ${teamId}
    order by (m.role = 'owner') desc, u.email asc
  `
  return rows as unknown as TeamMember[]
}

export async function addTeamMember(
  teamId: string,
  email: string,
  role: TeamRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = await db()
  const users = await sql`select id from users where lower(email) = ${email.trim().toLowerCase()}`
  if (users.length === 0) return { ok: false, error: 'No user with that email has signed in yet' }
  const userId = (users[0] as { id: string }).id
  await sql`
    insert into team_members (team_id, user_id, role) values (${teamId}, ${userId}, ${role})
    on conflict (team_id, user_id) do update set role = excluded.role
  `
  return { ok: true }
}

export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  const sql = await db()
  await sql`delete from team_members where team_id = ${teamId} and user_id = ${userId} and role <> 'owner'`
}
