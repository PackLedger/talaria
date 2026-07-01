import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getSessionUser } from '@/server/auth/session'
import { createBoard, listBoards } from '@/server/boards'

// GET /api/boards → boards the user owns or that are shared with them.
// POST /api/boards { name } → create a board (user becomes owner).
export const Route = createFileRoute('/api/boards')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        return json({ boards: await listBoards(user.id) })
      },
      POST: async ({ request }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        const parsed = z.object({ name: z.string().min(1).max(120) }).safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        return json({ board: await createBoard(user.id, parsed.data.name) })
      },
    },
  },
})
