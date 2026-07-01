import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getSessionUser } from '@/server/auth/session'
import { boardRole, canEdit, getBoardAgentConfig, setBoardAgentConfig } from '@/server/boards'

// GET → { allowAll, models }. PUT { allowAll, models } → set the board's agent
// policy (owner/editor). Boards are restrictive by default (allowAll off).
export const Route = createFileRoute('/api/boards/$id/agents')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        if (!(await boardRole(user.id, params.id))) return json({ error: 'forbidden' }, { status: 403 })
        return json(await getBoardAgentConfig(params.id))
      },
      PUT: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        if (!canEdit(await boardRole(user.id, params.id))) return json({ error: 'forbidden' }, { status: 403 })
        const parsed = z
          .object({ allowAll: z.boolean().default(false), models: z.array(z.string().max(200)).max(100).default([]) })
          .safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        await setBoardAgentConfig(params.id, parsed.data.allowAll, parsed.data.models)
        return json(await getBoardAgentConfig(params.id))
      },
    },
  },
})
