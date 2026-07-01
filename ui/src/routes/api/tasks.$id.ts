import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getSessionUser } from '@/server/auth/session'
import { checkAgentKey } from '@/server/agent-auth'
import { boardRole, canEdit } from '@/server/boards'
import { getTask, PRIORITIES, TASK_STATUSES, updateTask } from '@/server/tasks'

const AllStatuses = [...TASK_STATUSES, 'failed', 'cancelled'] as const
const Patch = z.object({
  status: z.enum(AllStatuses).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignedTo: z.string().max(200).nullish(),
  result: z.string().max(50_000).nullish(),
})

// GET → a task (board member). PUT → update it (board owner/editor via session,
// OR the assigned agent via TALARIA_AGENT_KEY reporting status/result).
export const Route = createFileRoute('/api/tasks/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        const task = await getTask(params.id)
        if (!task) return json({ error: 'not found' }, { status: 404 })
        if (!(await boardRole(user.id, task.boardId))) return json({ error: 'forbidden' }, { status: 403 })
        return json({ task })
      },
      PUT: async ({ request, params }) => {
        const task = await getTask(params.id)
        if (!task) return json({ error: 'not found' }, { status: 404 })

        // Agent reporting (key auth) OR a board editor (session).
        let allowed = checkAgentKey(request)
        if (!allowed) {
          const user = await getSessionUser(request)
          allowed = !!user && canEdit(await boardRole(user.id, task.boardId))
        }
        if (!allowed) return json({ error: 'forbidden' }, { status: 403 })

        const parsed = Patch.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        const updated = await updateTask(params.id, {
          status: parsed.data.status,
          priority: parsed.data.priority,
          assignedTo: parsed.data.assignedTo === undefined ? undefined : parsed.data.assignedTo,
          result: parsed.data.result ?? undefined,
        })
        return json({ task: updated })
      },
    },
  },
})
