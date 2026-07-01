import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getSessionUser } from '@/server/auth/session'
import { addTeamMember, listTeamMembers, removeTeamMember, teamRole } from '@/server/teams'

// GET → members (any member). POST { email, role } → add (owner). DELETE { userId } → remove (owner).
export const Route = createFileRoute('/api/teams/$id/members')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        if (!(await teamRole(user.id, params.id))) return json({ error: 'forbidden' }, { status: 403 })
        return json({ members: await listTeamMembers(params.id) })
      },
      POST: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        if ((await teamRole(user.id, params.id)) !== 'owner') return json({ error: 'forbidden' }, { status: 403 })
        const parsed = z
          .object({ email: z.string().email(), role: z.enum(['owner', 'member']).default('member') })
          .safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        const result = await addTeamMember(params.id, parsed.data.email, parsed.data.role)
        return result.ok ? json({ ok: true }) : json({ ok: false, error: result.error }, { status: 400 })
      },
      DELETE: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        if ((await teamRole(user.id, params.id)) !== 'owner') return json({ error: 'forbidden' }, { status: 403 })
        const parsed = z.object({ userId: z.string().uuid() }).safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        await removeTeamMember(params.id, parsed.data.userId)
        return json({ ok: true })
      },
    },
  },
})
