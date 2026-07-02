import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getSessionUser } from '@/server/auth/session'
import { boardAllowsAgent, boardRole, canEdit } from '@/server/boards'
import { createTask, listBoardTasks, EFFORTS, PRIORITIES } from '@/server/tasks'

// GET → the board's tasks (any member). POST → create a card (owner/editor).
export const Route = createFileRoute('/api/boards/$id/tasks')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        if (!(await boardRole(user.id, params.id))) return json({ error: 'forbidden' }, { status: 403 })
        const includeArchived = new URL(request.url).searchParams.get('archived') === '1'
        return json({ tasks: await listBoardTasks(params.id, includeArchived) })
      },
      POST: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        if (!canEdit(await boardRole(user.id, params.id))) return json({ error: 'forbidden' }, { status: 403 })
        const parsed = z
          .object({
            title: z.string().min(1).max(300),
            description: z.string().max(20_000).optional(),
            priority: z.enum(PRIORITIES).optional(),
            effort: z.enum(EFFORTS).nullish(),
            assignees: z.array(z.string().max(200)).max(20).optional(),
            dueDate: z.string().datetime().nullish(),
          })
          .safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        for (const a of parsed.data.assignees ?? []) {
          if (!(await boardAllowsAgent(params.id, a))) {
            return json({ error: `agent "${a}" is not allowed on this board` }, { status: 400 })
          }
        }
        const task = await createTask({
          boardId: params.id,
          title: parsed.data.title,
          description: parsed.data.description,
          priority: parsed.data.priority,
          effort: parsed.data.effort ?? null,
          assignees: parsed.data.assignees ?? [],
          dueDate: parsed.data.dueDate ?? null,
          createdBy: user.email ?? user.name ?? 'user',
        })
        return json({ task })
      },
    },
  },
})
