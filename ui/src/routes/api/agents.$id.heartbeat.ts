import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { checkAgentKey } from '@/server/agent-auth'
import { heartbeatAgent } from '@/server/agents-registry'

// GET /api/agents/:id/heartbeat — refresh the agent's last_seen and return any
// assigned work (empty until the task queue is ripped in). MC-compatible.
export const Route = createFileRoute('/api/agents/$id/heartbeat')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!checkAgentKey(request)) return json({ error: 'unauthorized' }, { status: 401 })
        const ok = await heartbeatAgent(params.id)
        if (!ok) return json({ error: 'unknown agent' }, { status: 404 })
        return json({ work_items: [] })
      },
    },
  },
})
