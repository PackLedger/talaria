import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { checkAgentKey } from '@/server/agent-auth'
import { heartbeatAgent } from '@/server/agents-registry'
import { assignedWork } from '@/server/tasks'

// GET /api/agents/:id/heartbeat — refresh last_seen and return the agent's
// assigned work (tasks assigned to it, across boards). MC-compatible.
export const Route = createFileRoute('/api/agents/$id/heartbeat')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!checkAgentKey(request)) return json({ error: 'unauthorized' }, { status: 401 })
        const name = await heartbeatAgent(params.id)
        if (!name) return json({ error: 'unknown agent' }, { status: 404 })
        return json({ work_items: await assignedWork(name) })
      },
    },
  },
})
