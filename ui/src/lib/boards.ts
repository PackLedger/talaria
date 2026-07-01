import { useQuery } from '@tanstack/react-query'
import type { Priority, Task, TaskStatus } from '@/lib/task-const'

export type BoardRole = 'owner' | 'editor' | 'viewer'
export interface Board {
  id: string
  name: string
  ownerId: string
  role: BoardRole
  createdAt: string
  updatedAt: string
}
export interface BoardMember {
  userId: string
  email: string | null
  name: string | null
  role: BoardRole
}

const j = async (r: Response) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })

export function useBoards() {
  return useQuery({
    queryKey: ['boards'],
    queryFn: async (): Promise<Board[]> => {
      const r = await fetch('/api/boards', { credentials: 'same-origin' })
      if (!r.ok) return []
      return (await r.json()).boards
    },
  })
}

export function useBoardTasks(boardId: string | null) {
  return useQuery({
    queryKey: ['board-tasks', boardId],
    enabled: !!boardId,
    refetchInterval: 5_000,
    queryFn: async (): Promise<Task[]> => {
      const r = await fetch(`/api/boards/${boardId}/tasks`, { credentials: 'same-origin' })
      if (!r.ok) return []
      return (await r.json()).tasks
    },
  })
}

export function useBoardMembers(boardId: string | null) {
  return useQuery({
    queryKey: ['board-members', boardId],
    enabled: !!boardId,
    queryFn: async (): Promise<BoardMember[]> => {
      const r = await fetch(`/api/boards/${boardId}/members`, { credentials: 'same-origin' })
      if (!r.ok) return []
      return (await r.json()).members
    },
  })
}

// ── Actions ──────────────────────────────────────────────────────────────────
export const createBoard = (name: string) => post('/api/boards', { name }).then(j)
export const createTask = (
  boardId: string,
  input: { title: string; description?: string; priority?: Priority; assignedTo?: string | null },
) => post(`/api/boards/${boardId}/tasks`, input).then(j)

export const updateTask = (
  taskId: string,
  patch: { status?: TaskStatus; priority?: Priority; assignedTo?: string | null; result?: string | null },
) =>
  fetch(`/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(patch),
  }).then(j)

export const shareBoard = (boardId: string, email: string, role: 'editor' | 'viewer') =>
  post(`/api/boards/${boardId}/members`, { email, role })
export const unshareBoard = (boardId: string, userId: string) =>
  fetch(`/api/boards/${boardId}/members`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ userId }),
  })
