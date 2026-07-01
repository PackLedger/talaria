import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { enabledProviders, getAuthConfig } from '@/server/auth/config'

// GET /api/auth/providers → the providers the login screen should render.
// Reflects exactly which providers are enabled AND fully configured right now.
export const Route = createFileRoute('/api/auth/providers')({
  server: {
    handlers: {
      GET: async () => {
        const cfg = getAuthConfig()
        return json({
          providers: enabledProviders(cfg),
          // Surfaced so the login screen can warn instead of silently failing.
          configured: Boolean(cfg.secret),
        })
      },
    },
  },
})
