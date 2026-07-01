import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { listAgents } from '@/server/gateway'
import { getSessionUser } from '@/server/auth/session'

// GET /api/agents → the fleet (from the gateway plane's /v1/models). Auth-gated.
export const Route = createFileRoute('/api/agents')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!getSessionUser(request)) return json({ error: 'unauthorized' }, { status: 401 })
        const { agents, source } = await listAgents()
        return json({ agents, source })
      },
    },
  },
})
