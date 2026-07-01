import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getSessionUser } from '@/server/auth/session'
import { getFleetOverview } from '@/server/fleet'

// GET /api/fleet → owned fleet ops data (agents + Talaria-native usage). Auth-gated.
export const Route = createFileRoute('/api/fleet')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await getSessionUser(request))) return json({ error: 'unauthorized' }, { status: 401 })
        return json(await getFleetOverview())
      },
    },
  },
})
