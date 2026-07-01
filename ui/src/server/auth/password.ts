// Username / password provider (env-configured user list).
//
// MVP: passwords are compared in constant time against AUTH_USERS entries. These
// are plaintext-in-env today — fine for a single-operator self-host, but the
// obvious next step is hashed credentials (bcrypt/argon2). Tracked in the UI TODO.

import { timingSafeEqual } from 'node:crypto'
import { getAuthConfig } from './config'
import type { Identity } from '../users'

export type LoginResult = Identity & { provider: 'password' }

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** Verify credentials against AUTH_USERS. Returns the identity or null. */
export function verifyPasswordLogin(username: string, password: string): LoginResult | null {
  const cfg = getAuthConfig()
  if (!cfg.password.enabled) return null

  // Walk every user so timing doesn't leak which usernames exist.
  let matched: LoginResult | null = null
  for (const u of cfg.password.users) {
    const userOk = constantTimeEquals(u.username.toLowerCase(), username.trim().toLowerCase())
    const passOk = constantTimeEquals(u.password, password)
    if (userOk && passOk) {
      matched = {
        sub: `password:${u.username.toLowerCase()}`,
        email: u.username.includes('@') ? u.username.toLowerCase() : null,
        name: u.username,
        picture: null,
        provider: 'password' as const,
      }
    }
  }
  return matched
}
