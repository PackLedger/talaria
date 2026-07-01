// Task queue — Talaria owns it (ripped from mission-control). Tasks are cards on
// a board, with comments, an activity log, and rich fields. Agents get assigned
// work via heartbeat and report via PUT /api/tasks/:id.
import { db } from './db/pg'
import type { Priority, Task, TaskActivity, TaskComment, TaskStatus } from '@/lib/task-const'

// Re-export the shared constants/types for server routes' convenience.
export { TASK_STATUSES, PRIORITIES } from '@/lib/task-const'
export type { Priority, Task, TaskStatus } from '@/lib/task-const'

const TASK_COLS = `id, board_id as "boardId", title, description, status, priority,
  assigned_to as "assignedTo", created_by as "createdBy", result,
  due_date as "dueDate", tags, created_at as "createdAt", updated_at as "updatedAt"`

export async function listBoardTasks(boardId: string): Promise<Task[]> {
  const sql = await db()
  const rows = await sql.unsafe(`select ${TASK_COLS} from tasks where board_id = $1 order by updated_at desc`, [boardId])
  return rows as unknown as Task[]
}

export async function getTask(id: string): Promise<Task | null> {
  const sql = await db()
  const rows = await sql.unsafe(`select ${TASK_COLS} from tasks where id = $1`, [id])
  return (rows[0] as unknown as Task) ?? null
}

export async function getTaskFull(
  id: string,
): Promise<{ task: Task; comments: TaskComment[]; activity: TaskActivity[] } | null> {
  const task = await getTask(id)
  if (!task) return null
  return { task, comments: await listComments(id), activity: await listActivity(id) }
}

export async function createTask(input: {
  boardId: string
  title: string
  description?: string | null
  priority?: Priority
  assignedTo?: string | null
  dueDate?: string | null
  createdBy: string
}): Promise<Task> {
  const sql = await db()
  const status = input.assignedTo ? 'assigned' : 'inbox'
  const rows = await sql.unsafe(
    `insert into tasks (board_id, title, description, priority, assigned_to, due_date, created_by, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning ${TASK_COLS}`,
    [
      input.boardId,
      input.title,
      input.description ?? null,
      input.priority ?? 'medium',
      input.assignedTo ?? null,
      input.dueDate ?? null,
      input.createdBy,
      status,
    ],
  )
  const task = rows[0] as unknown as Task
  await logActivity(task.id, input.createdBy, 'created', `created this task`)
  if (input.assignedTo) await logActivity(task.id, input.createdBy, 'assigned', `assigned to ${input.assignedTo}`)
  return task
}

export interface TaskPatch {
  title?: string
  description?: string | null
  status?: TaskStatus
  priority?: Priority
  assignedTo?: string | null
  result?: string | null
  dueDate?: string | null
  tags?: string[]
}

export async function updateTask(id: string, patch: TaskPatch, actor: string): Promise<Task | null> {
  const sql = await db()
  const cur = await getTask(id)
  if (!cur) return null

  const next = {
    title: patch.title ?? cur.title,
    description: patch.description === undefined ? cur.description : patch.description,
    assignedTo: patch.assignedTo === undefined ? cur.assignedTo : patch.assignedTo,
    priority: patch.priority ?? cur.priority,
    result: patch.result === undefined ? cur.result : patch.result,
    dueDate: patch.dueDate === undefined ? cur.dueDate : patch.dueDate,
    tags: patch.tags ?? cur.tags,
    status: (patch.status ??
      (patch.assignedTo && cur.status === 'inbox' ? 'assigned' : cur.status)) as TaskStatus,
  }

  const rows = await sql.unsafe(
    `update tasks set title=$2, description=$3, status=$4, priority=$5, assigned_to=$6,
       result=$7, due_date=$8, tags=$9::jsonb, updated_at=now() where id=$1 returning ${TASK_COLS}`,
    [id, next.title, next.description, next.status, next.priority, next.assignedTo, next.result, next.dueDate, JSON.stringify(next.tags)],
  )
  const task = rows[0] as unknown as Task

  // Activity log for the meaningful changes.
  if (patch.status && patch.status !== cur.status) await logActivity(id, actor, 'status', `moved to ${patch.status}`)
  if (patch.assignedTo !== undefined && patch.assignedTo !== cur.assignedTo)
    await logActivity(id, actor, 'assigned', patch.assignedTo ? `assigned to ${patch.assignedTo}` : 'unassigned')
  if (patch.priority && patch.priority !== cur.priority) await logActivity(id, actor, 'priority', `priority → ${patch.priority}`)
  if (patch.result && patch.result !== cur.result) await logActivity(id, actor, 'result', 'reported a result')
  return task
}

export async function deleteTask(id: string): Promise<void> {
  const sql = await db()
  await sql`delete from tasks where id = ${id}`
}

// ── Comments ─────────────────────────────────────────────────────────────────
export async function listComments(taskId: string): Promise<TaskComment[]> {
  const sql = await db()
  const rows = await sql`
    select id, author, content, parent_id as "parentId", created_at as "createdAt"
    from task_comments where task_id = ${taskId} order by created_at asc
  `
  return rows as unknown as TaskComment[]
}

export async function addComment(taskId: string, author: string, content: string, parentId?: string): Promise<TaskComment> {
  const sql = await db()
  const rows = await sql`
    insert into task_comments (task_id, author, content, parent_id)
    values (${taskId}, ${author}, ${content}, ${parentId ?? null})
    returning id, author, content, parent_id as "parentId", created_at as "createdAt"
  `
  await logActivity(taskId, author, 'comment', 'commented')
  return rows[0] as unknown as TaskComment
}

// ── Activity ─────────────────────────────────────────────────────────────────
export async function logActivity(taskId: string, actor: string, type: string, description: string): Promise<void> {
  const sql = await db()
  await sql`insert into task_activity (task_id, actor, type, description) values (${taskId}, ${actor}, ${type}, ${description})`
}

export async function listActivity(taskId: string): Promise<TaskActivity[]> {
  const sql = await db()
  const rows = await sql`
    select id, actor, type, description, created_at as "createdAt"
    from task_activity where task_id = ${taskId} order by created_at desc limit 100
  `
  return rows as unknown as TaskActivity[]
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
