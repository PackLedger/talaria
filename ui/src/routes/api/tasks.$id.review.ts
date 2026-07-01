import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getSessionUser } from '@/server/auth/session'
import { boardRole, canEdit } from '@/server/boards'
import { addReview, getTask, updateTask } from '@/server/tasks'

const Body = z.object({ status: z.enum(['approved', 'rejected']), notes: z.string().max(20_000).optional() })

// POST /api/tasks/:id/review — the human quality gate. Approve moves the task to
// done; reject sends it back to in_progress. Board owner/editor only.
export const Route = createFileRoute('/api/tasks/$id/review')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        const task = await getTask(params.id)
        if (!task) return json({ error: 'not found' }, { status: 404 })
        if (!canEdit(await boardRole(user.id, task.boardId))) return json({ error: 'forbidden' }, { status: 403 })

        const parsed = Body.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        const reviewer = user.email ?? user.name ?? 'reviewer'
        await addReview(params.id, reviewer, parsed.data.status, parsed.data.notes)
        const task2 = await updateTask(params.id, { status: parsed.data.status === 'approved' ? 'done' : 'in_progress' }, reviewer)
        return json({ task: task2 })
      },
    },
  },
})
