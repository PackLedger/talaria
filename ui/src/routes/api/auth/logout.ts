import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { clearSessionCookie } from '@/server/auth/session'

// POST /api/auth/logout → clear the session cookie.
export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async () =>
        json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } }),
    },
  },
})
