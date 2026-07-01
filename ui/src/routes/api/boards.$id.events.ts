import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getSessionUser } from '@/server/auth/session'
import { boardRole } from '@/server/boards'
import { boardEventStream } from '@/server/realtime'

// GET /api/boards/:id/events → SSE stream of this board's live events (task/
// comment changes). Auth-gated to board members. Powers multiplayer boards.
export const Route = createFileRoute('/api/boards/$id/events')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getSessionUser(request)
        if (!user) return json({ error: 'unauthorized' }, { status: 401 })
        if (!(await boardRole(user.id, params.id))) return json({ error: 'forbidden' }, { status: 403 })
        return new Response(boardEventStream(params.id, request.signal), {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          },
        })
      },
    },
  },
})
