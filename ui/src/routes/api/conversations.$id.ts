import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getSessionUser } from '@/server/auth/session'
import { getConversation } from '@/server/conversations'

// GET /api/conversations/:id → a conversation + its messages (ownership-checked).
export const Route = createFileRoute('/api/conversations/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        const result = await getConversation(user.id, params.id)
        if (!result) return json({ error: 'not found' }, { status: 404 })
        return json(result)
      },
    },
  },
})
