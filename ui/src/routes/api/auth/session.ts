import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getSessionUser } from '@/server/auth/session'

// GET /api/auth/session → the current user (or { user: null } when signed out).
export const Route = createFileRoute('/api/auth/session')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return json({ user: await getSessionUser(request) })
      },
    },
  },
})
