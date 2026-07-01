import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: () => (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <div className="mercury-text mb-1 text-2xl font-semibold">404</div>
          <p className="text-sm text-muted">That view doesn’t exist (yet).</p>
          <a href="/" className="mt-3 inline-block text-sm text-accent hover:underline">
            Back to chat
          </a>
        </div>
      </div>
    ),
  })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
