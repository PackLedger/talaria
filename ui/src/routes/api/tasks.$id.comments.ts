import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getSessionUser } from '@/server/auth/session'
import { checkAgentKey } from '@/server/agent-auth'
import { boardRole } from '@/server/boards'
import { addComment, getTask, listComments } from '@/server/tasks'

// GET → a task's comments (board member). POST → add a comment (member or agent).
export const Route = createFileRoute('/api/tasks/$id/comments')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        const task = await getTask(params.id)
        if (!task) return json({ error: 'not found' }, { status: 404 })
        if (!(await boardRole(user.id, task.boardId))) return json({ error: 'forbidden' }, { status: 403 })
        return json({ comments: await listComments(params.id) })
      },
      POST: async ({ request, params }) => {
        const task = await getTask(params.id)
        if (!task) return json({ error: 'not found' }, { status: 404 })

        const agent = checkAgentKey(request)
        let author = 'agent'
        if (!agent) {
          const user = await getSessionUser(request)
          if (!user || !(await boardRole(user.id, task.boardId))) return json({ error: 'forbidden' }, { status: 403 })
          author = user.email ?? user.name ?? 'user'
        }

        const parsed = z
          .object({ content: z.string().min(1).max(20_000), parentId: z.string().uuid().optional() })
          .safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        return json({ comment: await addComment(params.id, author, parsed.data.content, parsed.data.parentId) })
      },
    },
  },
})
