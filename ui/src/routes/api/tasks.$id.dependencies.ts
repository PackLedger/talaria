import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getSessionUser } from '@/server/auth/session'
import { boardRole, canEdit } from '@/server/boards'
import { addDependency, getTask, removeDependency } from '@/server/tasks'

const Body = z.object({ dependsOnId: z.string().uuid() })

// POST { dependsOnId } → this ticket is blocked by another. DELETE → remove.
// Editors only; the dependency target must live on the same board.
export const Route = createFileRoute('/api/tasks/$id/dependencies')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        const task = await getTask(params.id)
        if (!task || !canEdit(await boardRole(user.id, task.boardId))) return json({ error: 'forbidden' }, { status: 403 })
        const parsed = Body.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        const dep = await getTask(parsed.data.dependsOnId)
        if (!dep || dep.boardId !== task.boardId) return json({ error: 'must be a ticket on this board' }, { status: 400 })
        const actor = user.email ?? user.name ?? 'user'
        await addDependency(params.id, parsed.data.dependsOnId, actor)
        return json({ ok: true })
      },
      DELETE: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        const task = await getTask(params.id)
        if (!task || !canEdit(await boardRole(user.id, task.boardId))) return json({ error: 'forbidden' }, { status: 403 })
        const parsed = Body.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        await removeDependency(params.id, parsed.data.dependsOnId)
        return json({ ok: true })
      },
    },
  },
})
