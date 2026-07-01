import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getSessionUser } from '@/server/auth/session'
import { checkAgentKey } from '@/server/agent-auth'
import { boardRole, canEdit } from '@/server/boards'
import { deleteTask, getTask, getTaskFull, PRIORITIES, TASK_STATUSES, updateTask } from '@/server/tasks'

const AllStatuses = [...TASK_STATUSES, 'failed', 'cancelled'] as const
const Patch = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(20_000).nullish(),
  status: z.enum(AllStatuses).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignedTo: z.string().max(200).nullish(),
  result: z.string().max(50_000).nullish(),
  dueDate: z.string().datetime().nullish(),
  tags: z.array(z.string().max(40)).max(20).optional(),
})

// GET → full task (task + comments + activity), board member.
// PUT → update (board owner/editor via session, OR the agent via TALARIA_AGENT_KEY).
// DELETE → board owner/editor.
export const Route = createFileRoute('/api/tasks/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        const full = await getTaskFull(params.id)
        if (!full) return json({ error: 'not found' }, { status: 404 })
        if (!(await boardRole(user.id, full.task.boardId))) return json({ error: 'forbidden' }, { status: 403 })
        return json(full)
      },
      PUT: async ({ request, params }) => {
        const task = await getTask(params.id)
        if (!task) return json({ error: 'not found' }, { status: 404 })

        const agent = checkAgentKey(request)
        let actor = 'agent'
        if (!agent) {
          const user = await getSessionUser(request)
          if (!user || !canEdit(await boardRole(user.id, task.boardId))) return json({ error: 'forbidden' }, { status: 403 })
          actor = user.email ?? user.name ?? 'user'
        }

        const parsed = Patch.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        const updated = await updateTask(params.id, parsed.data, actor)
        return json({ task: updated })
      },
      DELETE: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        const task = await getTask(params.id)
        if (!task) return json({ error: 'not found' }, { status: 404 })
        if (!canEdit(await boardRole(user.id, task.boardId))) return json({ error: 'forbidden' }, { status: 403 })
        await deleteTask(params.id)
        return json({ ok: true })
      },
    },
  },
})
