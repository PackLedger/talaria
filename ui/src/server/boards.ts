// Boards — user-owned kanban boards, shareable across the team. Membership is
// the share mechanism (role: owner | editor | viewer).
import { db } from './db/pg'

export type BoardRole = 'owner' | 'editor' | 'viewer'

export interface Board {
  id: string
  name: string
  ownerId: string
  role: BoardRole // the requesting user's role
  createdAt: string
  updatedAt: string
}

export interface BoardMember {
  userId: string
  email: string | null
  name: string | null
  role: BoardRole
}

/** Boards the user can see (owns or shared with). */
export async function listBoards(userId: string): Promise<Board[]> {
  const sql = await db()
  const rows = await sql`
    select b.id, b.name, b.owner_id as "ownerId", m.role,
           b.created_at as "createdAt", b.updated_at as "updatedAt"
    from boards b
    join board_members m on m.board_id = b.id and m.user_id = ${userId}
    order by b.updated_at desc
  `
  return rows as unknown as Board[]
}

/** The user's role on a board, or null if no access. */
export async function boardRole(userId: string, boardId: string): Promise<BoardRole | null> {
  const sql = await db()
  const rows = await sql`select role from board_members where board_id = ${boardId} and user_id = ${userId}`
  return rows.length ? (rows[0] as { role: BoardRole }).role : null
}

export const canEdit = (role: BoardRole | null) => role === 'owner' || role === 'editor'

/** Create a board and make the creator its owner. */
export async function createBoard(userId: string, name: string): Promise<Board> {
  const sql = await db()
  const board = await sql.begin(async (tx) => {
    const rows = await tx`insert into boards (name, owner_id) values (${name}, ${userId}) returning id, name, owner_id as "ownerId", created_at as "createdAt", updated_at as "updatedAt"`
    const b = rows[0] as Omit<Board, 'role'>
    await tx`insert into board_members (board_id, user_id, role) values (${b.id}, ${userId}, 'owner')`
    return b
  })
  return { ...board, role: 'owner' }
}

export async function renameBoard(boardId: string, name: string): Promise<void> {
  const sql = await db()
  await sql`update boards set name = ${name}, updated_at = now() where id = ${boardId}`
}

export async function deleteBoard(boardId: string): Promise<void> {
  const sql = await db()
  await sql`delete from boards where id = ${boardId}`
}

export async function listMembers(boardId: string): Promise<BoardMember[]> {
  const sql = await db()
  const rows = await sql`
    select m.user_id as "userId", u.email, u.name, m.role
    from board_members m join users u on u.id = m.user_id
    where m.board_id = ${boardId}
    order by (m.role = 'owner') desc, u.email asc
  `
  return rows as unknown as BoardMember[]
}

/** Share a board with a teammate by email (they must have signed in before). */
export async function shareBoard(
  boardId: string,
  email: string,
  role: BoardRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = await db()
  const users = await sql`select id from users where lower(email) = ${email.trim().toLowerCase()}`
  if (users.length === 0) return { ok: false, error: 'No user with that email has signed in yet' }
  const userId = (users[0] as { id: string }).id
  await sql`
    insert into board_members (board_id, user_id, role) values (${boardId}, ${userId}, ${role})
    on conflict (board_id, user_id) do update set role = excluded.role
  `
  return { ok: true }
}

export async function unshareBoard(boardId: string, userId: string): Promise<void> {
  const sql = await db()
  // Never remove the owner via unshare.
  await sql`delete from board_members where board_id = ${boardId} and user_id = ${userId} and role <> 'owner'`
}
