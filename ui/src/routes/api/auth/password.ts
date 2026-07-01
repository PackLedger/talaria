import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getAuthConfig, isEmailAllowed } from '@/server/auth/config'
import { verifyPasswordLogin } from '@/server/auth/password'
import { createSessionToken, sessionCookie } from '@/server/auth/session'

const Body = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(1000),
})

// Naive per-process rate limit: 5 attempts / IP / minute. Good enough for a
// self-hosted single-node dashboard; swap for a shared store if scaled out.
const attempts = new Map<string, { count: number; resetAt: number }>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec || rec.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  rec.count += 1
  return rec.count > 5
}

// POST /api/auth/password { username, password } → sets the session cookie.
export const Route = createFileRoute('/api/auth/password')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfg = getAuthConfig()
        if (!cfg.password.enabled) {
          return json({ ok: false, error: 'Password login is disabled' }, { status: 400 })
        }
        if (!cfg.secret) {
          return json({ ok: false, error: 'Server auth is not configured (AUTH_SECRET)' }, { status: 500 })
        }

        const ip =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
        if (rateLimited(ip)) {
          return json({ ok: false, error: 'Too many attempts, try again shortly' }, { status: 429 })
        }

        const parsed = Body.safeParse(await request.json().catch(() => null))
        if (!parsed.success) {
          return json({ ok: false, error: 'Invalid request' }, { status: 400 })
        }

        const user = verifyPasswordLogin(parsed.data.username, parsed.data.password)
        if (!user || !isEmailAllowed(user.email, cfg)) {
          // Slow the failure path a touch to blunt brute force.
          await new Promise((r) => setTimeout(r, 400))
          return json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
        }

        const token = createSessionToken(user, cfg.secret)
        return json({ ok: true, user }, { headers: { 'Set-Cookie': sessionCookie(token) } })
      },
    },
  },
})
