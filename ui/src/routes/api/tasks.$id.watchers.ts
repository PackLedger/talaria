import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getSessionUser } from '@/server/auth/session'
import { boardRole } from '@/server/boards'
import { addWatcher, getTask, listWatchers, removeWatcher } from '@/server/tasks'

const Body = z.object({ watcher: z.string().min(1).max(200) })

// POST { watcher } → follow. DELETE { watcher } → unfollow. Board members only.
export const Route = createFileRoute('/api/tasks/$id/watchers')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        const task = await getTask(params.id)
        if (!task || !(await boardRole(user.id, task.boardId))) return json({ error: 'forbidden' }, { status: 403 })
        const parsed = Body.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        await addWatcher(params.id, parsed.data.watcher)
        return json({ watchers: await listWatchers(params.id) })
      },
      DELETE: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        const task = await getTask(params.id)
        if (!task || !(await boardRole(user.id, task.boardId))) return json({ error: 'forbidden' }, { status: 403 })
        const parsed = Body.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        await removeWatcher(params.id, parsed.data.watcher)
        return json({ watchers: await listWatchers(params.id) })
      },
    },
  },
})
