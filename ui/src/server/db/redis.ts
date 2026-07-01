// Redis — ephemeral state (sessions, and later: live-stream fan-out, rate
// limits, caches). Cached on globalThis so HMR reuses one connection.

import Redis from 'ioredis'

const g = globalThis as unknown as { __talariaRedis?: Redis }

export function getRedis(): Redis {
  if (!g.__talariaRedis) {
    const url = process.env.REDIS_URL
    if (!url) throw new Error('REDIS_URL is not set')
    g.__talariaRedis = new Redis(url, { maxRetriesPerRequest: 3 })
  }
  return g.__talariaRedis
}
