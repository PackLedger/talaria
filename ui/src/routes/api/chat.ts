import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { proxyChat } from '@/server/gateway'
import { getSessionUser } from '@/server/auth/session'

const Body = z.object({
  model: z.string().min(1),
  messages: z
    .array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string() }))
    .min(1),
})

// POST /api/chat → streaming chat, proxied to the gateway plane (model-routed to
// the agent). Auth-gated; returns SSE (OpenAI chunk format).
export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!getSessionUser(request)) return json({ error: 'unauthorized' }, { status: 401 })
        const parsed = Body.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'bad request' }, { status: 400 })
        return proxyChat(parsed.data)
      },
    },
  },
})
