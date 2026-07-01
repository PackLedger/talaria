import { createFileRoute } from '@tanstack/react-router'
import { getAuthConfig, isEmailAllowed } from '@/server/auth/config'
import { exchangeGoogleCode, googleRedirectUri } from '@/server/auth/google'
import {
  clearStateCookie,
  createSessionToken,
  parseCookies,
  sessionCookie,
  STATE_COOKIE,
} from '@/server/auth/session'

// Bounce back to the login screen with a machine-readable reason.
function loginError(reason: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `/login?error=${encodeURIComponent(reason)}`, 'Set-Cookie': clearStateCookie() },
  })
}

// GET /api/auth/google/callback → verify state, exchange the code, mint the
// session, and land on the cockpit.
export const Route = createFileRoute('/api/auth/google/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cfg = getAuthConfig()
        if (!cfg.google.enabled || !cfg.secret) return loginError('google_disabled')

        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const cookieState = parseCookies(request)[STATE_COOKIE]

        if (url.searchParams.get('error')) return loginError('google_denied')
        if (!code || !state || !cookieState || state !== cookieState) {
          return loginError('bad_state')
        }

        let user
        try {
          user = await exchangeGoogleCode(code, googleRedirectUri(request))
        } catch (err) {
          if (import.meta.env.DEV) console.error('[auth/google] callback failed:', err)
          return loginError('exchange_failed')
        }

        if (!isEmailAllowed(user.email, cfg)) return loginError('not_allowed')

        const token = createSessionToken(user, cfg.secret)
        const headers = new Headers({ Location: '/' })
        // Set the session and drop the one-shot state cookie.
        headers.append('Set-Cookie', sessionCookie(token))
        headers.append('Set-Cookie', clearStateCookie())
        return new Response(null, { status: 302, headers })
      },
    },
  },
})
