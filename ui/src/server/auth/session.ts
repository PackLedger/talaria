// Signed, stateless session + short-lived state cookies (HMAC-SHA256).
//
// A session is base64url(payload).base64url(hmac). No server-side store — the
// signature + exp are the trust. Rotate AUTH_SECRET to invalidate everything.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { getAuthConfig, type ProviderId } from './config'

export const SESSION_COOKIE = 'talaria_session'
export const STATE_COOKIE = 'talaria_oauth_state'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

export interface SessionUser {
  sub: string
  email: string | null
  name: string | null
  picture: string | null
  provider: ProviderId
}

interface SessionPayload extends SessionUser {
  iat: number
  exp: number
}

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64url')

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url')
}

/** Constant-time string compare that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function createSessionToken(user: SessionUser, secret: string): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = { ...user, iat: now, exp: now + SESSION_TTL_SECONDS }
  const body = b64url(JSON.stringify(payload))
  return `${body}.${sign(body, secret)}`
}

export function verifySessionToken(token: string | undefined, secret: string): SessionUser | null {
  if (!token || !secret) return null
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null
  const body = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  if (!safeEqual(mac, sign(body, secret))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null
    return {
      sub: payload.sub,
      email: payload.email ?? null,
      name: payload.name ?? null,
      picture: payload.picture ?? null,
      provider: payload.provider,
    }
  } catch {
    return null
  }
}

// ── Cookie helpers ─────────────────────────────────────────────────────────

export function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('cookie') ?? ''
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    if (k) out[k] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

function cookieString(name: string, value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export const sessionCookie = (token: string) => cookieString(SESSION_COOKIE, token, SESSION_TTL_SECONDS)
export const clearSessionCookie = () => cookieString(SESSION_COOKIE, '', 0)
export const stateCookie = (value: string) => cookieString(STATE_COOKIE, value, 600) // 10 min
export const clearStateCookie = () => cookieString(STATE_COOKIE, '', 0)

/** Read + verify the current user from the request's session cookie. */
export function getSessionUser(request: Request): SessionUser | null {
  const secret = getAuthConfig().secret
  return verifySessionToken(parseCookies(request)[SESSION_COOKIE], secret)
}

/** Random URL-safe token for OAuth state / CSRF. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
