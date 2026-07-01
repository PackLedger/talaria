import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getSessionUser } from '@/server/auth/session'
import { boardRole, deleteBoard, renameBoard } from '@/server/boards'

// PATCH /api/boards/:id { name } → rename (owner/editor). DELETE → owner only.
export const Route = createFileRoute('/api/boards/$id')({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        const role = await boardRole(user.id, params.id)
        if (role !== 'owner' && role !== 'editor') return json({ error: 'forbidden' }, { status: 403 })
        const parsed = z.object({ name: z.string().min(1).max(120) }).safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        await renameBoard(params.id, parsed.data.name)
        return json({ ok: true })
      },
      DELETE: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        if ((await boardRole(user.id, params.id)) !== 'owner') return json({ error: 'forbidden' }, { status: 403 })
        await deleteBoard(params.id)
        return json({ ok: true })
      },
    },
  },
})
