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
  dueDate: z.string().datetime().nullish(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  estimatedHours: z.number().min(0).max(10_000).nullish(),
  actualHours: z.number().min(0).max(10_000).nullish(),
  outcome: z.string().max(50_000).nullish(),
  resolution: z.string().max(50_000).nullish(),
  errorMessage: z.string().max(50_000).nullish(),
})

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
        // Approval gate: agents can't self-complete — they land in quality_review
        // for a human to approve to done.
        if (agent && parsed.data.status === 'done') parsed.data.status = 'quality_review'
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
