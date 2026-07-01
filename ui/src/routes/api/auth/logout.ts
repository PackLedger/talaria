import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { clearSessionCookie, destroySession } from '@/server/auth/session'

// POST /api/auth/logout → delete the Redis session + clear the cookie.
export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await destroySession(request)
        return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } })
      },
    },
  },
})
