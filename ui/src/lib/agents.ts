import { useQuery } from '@tanstack/react-query'
import type { AgentModel } from '@/server/gateway'

export type { AgentModel }

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async (): Promise<{ agents: AgentModel[]; source: 'gateway' | 'mock' }> => {
      const res = await fetch('/api/agents', { credentials: 'same-origin' })
      if (!res.ok) return { agents: [], source: 'mock' }
      return res.json()
    },
    staleTime: 30_000,
  })
}
