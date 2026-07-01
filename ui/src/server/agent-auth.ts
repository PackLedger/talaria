// Auth for the fleet-facing "brain" endpoints (register / heartbeat / report).
// Agents present TALARIA_AGENT_KEY as x-api-key (or Bearer) — matching the
// contract the plugin already speaks to mission-control, so it works repointed.

import { timingSafeEqual } from 'node:crypto'

function eq(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function checkAgentKey(request: Request): boolean {
  const expected = (process.env.TALARIA_AGENT_KEY ?? '').trim()
  if (!expected) return false
  const xkey = request.headers.get('x-api-key')?.trim()
  const auth = request.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
  return (!!xkey && eq(xkey, expected)) || (!!bearer && eq(bearer, expected))
}
