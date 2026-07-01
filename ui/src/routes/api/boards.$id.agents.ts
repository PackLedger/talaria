import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getSessionUser } from '@/server/auth/session'
import { boardRole, canEdit, listBoardAgents, setBoardAgents } from '@/server/boards'

// GET → the board's allowed agents (empty = all). PUT { models } → set the
// allow-list (owner/editor). Restricts who can be assigned tasks on this board.
export const Route = createFileRoute('/api/boards/$id/agents')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        if (!(await boardRole(user.id, params.id))) return json({ error: 'forbidden' }, { status: 403 })
        return json({ models: await listBoardAgents(params.id) })
      },
      PUT: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        if (!canEdit(await boardRole(user.id, params.id))) return json({ error: 'forbidden' }, { status: 403 })
        const parsed = z.object({ models: z.array(z.string().max(200)).max(100) }).safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        await setBoardAgents(params.id, parsed.data.models)
        return json({ models: await listBoardAgents(params.id) })
      },
    },
  },
})
