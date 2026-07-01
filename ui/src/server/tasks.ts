// Task queue — Talaria owns it (ripped from mission-control). Tasks are cards on
// a board; agents get assigned work via heartbeat and report via PUT /api/tasks/:id.
import { db } from './db/pg'
import type { Priority, Task, TaskStatus } from '@/lib/task-const'

// Re-export the shared constants/types for server routes' convenience.
export { TASK_STATUSES, PRIORITIES } from '@/lib/task-const'
export type { Priority, Task, TaskStatus } from '@/lib/task-const'

const COLS = `id, board_id as "boardId", title, description, status, priority,
  assigned_to as "assignedTo", created_by as "createdBy", result,
  created_at as "createdAt", updated_at as "updatedAt"`

export async function listBoardTasks(boardId: string): Promise<Task[]> {
  const sql = await db()
  const rows = await sql`
    select id, board_id as "boardId", title, description, status, priority,
           assigned_to as "assignedTo", created_by as "createdBy", result,
           created_at as "createdAt", updated_at as "updatedAt"
    from tasks where board_id = ${boardId} order by updated_at desc
  `
  return rows as unknown as Task[]
}

export async function getTask(id: string): Promise<Task | null> {
  const sql = await db()
  const rows = await sql.unsafe(`select ${COLS} from tasks where id = $1`, [id])
  return (rows[0] as unknown as Task) ?? null
}

export async function createTask(input: {
  boardId: string
  title: string
  description?: string | null
  priority?: Priority
  assignedTo?: string | null
  createdBy: string
}): Promise<Task> {
  const sql = await db()
  const status = input.assignedTo ? 'assigned' : 'inbox'
  const rows = await sql`
    insert into tasks (board_id, title, description, priority, assigned_to, created_by, status)
    values (${input.boardId}, ${input.title}, ${input.description ?? null}, ${input.priority ?? 'medium'},
            ${input.assignedTo ?? null}, ${input.createdBy}, ${status})
    returning id, board_id as "boardId", title, description, status, priority,
              assigned_to as "assignedTo", created_by as "createdBy", result,
              created_at as "createdAt", updated_at as "updatedAt"
  `
  return rows[0] as Task
}

export async function updateTask(
  id: string,
  patch: { status?: TaskStatus; priority?: Priority; assignedTo?: string | null; result?: string | null },
): Promise<Task | null> {
  const sql = await db()
  const cur = await getTask(id)
  if (!cur) return null

  // Merge in JS, then write concrete (typed) values — avoids null-param type
  // inference issues with dynamic SQL.
  const assignedTo = patch.assignedTo === undefined ? cur.assignedTo : patch.assignedTo
  const status: TaskStatus =
    patch.status ?? (assignedTo && cur.status === 'inbox' ? 'assigned' : cur.status)
  const priority = patch.priority ?? cur.priority
  const result = patch.result ?? cur.result

  const rows = await sql`
    update tasks set
      status = ${status}, priority = ${priority}, assigned_to = ${assignedTo},
      result = ${result}, updated_at = now()
    where id = ${id}
    returning id, board_id as "boardId", title, description, status, priority,
              assigned_to as "assignedTo", created_by as "createdBy", result,
              created_at as "createdAt", updated_at as "updatedAt"
  `
  return (rows[0] as Task) ?? null
}

/** Work assigned to an agent (by name), across all boards — for heartbeat. */
export async function assignedWork(agentName: string): Promise<Array<{ id: string; title: string; description: string | null }>> {
  const sql = await db()
  const rows = await sql`
    select id, title, description from tasks
    where assigned_to = ${agentName} and status in ('assigned', 'in_progress')
    order by created_at asc
  `
  return rows as unknown as Array<{ id: string; title: string; description: string | null }>
}
