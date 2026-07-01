import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getSessionUser } from '@/server/auth/session'
import { boardRole, canEdit, listMembers, shareBoard, unshareBoard } from '@/server/boards'

// GET → members. POST { email, role } → share (owner/editor). DELETE { userId } → unshare.
export const Route = createFileRoute('/api/boards/$id/members')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        if (!(await boardRole(user.id, params.id))) return json({ error: 'forbidden' }, { status: 403 })
        return json({ members: await listMembers(params.id) })
      },
      POST: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        if (!canEdit(await boardRole(user.id, params.id))) return json({ error: 'forbidden' }, { status: 403 })
        const parsed = z
          .object({ email: z.string().email(), role: z.enum(['editor', 'viewer']).default('editor') })
          .safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        const result = await shareBoard(params.id, parsed.data.email, parsed.data.role)
        return result.ok ? json({ ok: true }) : json({ ok: false, error: result.error }, { status: 400 })
      },
      DELETE: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        if (!canEdit(await boardRole(user.id, params.id))) return json({ error: 'forbidden' }, { status: 403 })
        const parsed = z.object({ userId: z.string().uuid() }).safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        await unshareBoard(params.id, parsed.data.userId)
        return json({ ok: true })
      },
    },
  },
})
