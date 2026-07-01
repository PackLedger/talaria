import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Priority, Task, TaskActivity, TaskComment, TaskStatus } from '@/lib/task-const'

/** Subscribe to a board's live event stream — multiplayer. On any event, refetch
 *  the board's tasks (and the open task) so all viewers stay in sync. */
export function useBoardLive(boardId: string | null) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!boardId) return
    const es = new EventSource(`/api/boards/${boardId}/events`)
    es.onmessage = () => {
      // Refresh the board (cards) live. We deliberately do NOT refetch an open
      // ticket here — that would thrash its editors mid-edit; the detail refetches
      // on the viewer's own actions.
      void qc.invalidateQueries({ queryKey: ['board-tasks', boardId] })
    }
    return () => es.close()
  }, [boardId, qc])
}

export type BoardRole = 'owner' | 'editor' | 'viewer'
export interface Board {
  id: string
  name: string
  ownerId: string
  teamId: string | null
  teamName: string | null
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

export interface BoardAgentConfig {
  allowAll: boolean
  models: string[]
}

/** The board's agent policy (restrictive by default: allowAll off, no models). */
export function useBoardAgents(boardId: string | null) {
  return useQuery({
    queryKey: ['board-agents', boardId],
    enabled: !!boardId,
    queryFn: async (): Promise<BoardAgentConfig> => {
      const r = await fetch(`/api/boards/${boardId}/agents`, { credentials: 'same-origin' })
      if (!r.ok) return { allowAll: false, models: [] }
      return r.json()
    },
  })
}

export const setBoardAgents = (boardId: string, allowAll: boolean, models: string[]) =>
  fetch(`/api/boards/${boardId}/agents`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ allowAll, models }),
  }).then(j)

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

export interface TaskFull {
  task: Task
  comments: TaskComment[]
  activity: TaskActivity[]
  watchers: string[]
  reviews: import('@/lib/task-const').QualityReview[]
}

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: ['task', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<TaskFull | null> => {
      const r = await fetch(`/api/tasks/${taskId}`, { credentials: 'same-origin' })
      if (!r.ok) return null
      return r.json()
    },
  })
}

// ── Actions ──────────────────────────────────────────────────────────────────
export const createBoard = (name: string, teamId?: string | null) => post('/api/boards', { name, teamId }).then(j)
export const createTask = (
  boardId: string,
  input: {
    title: string
    description?: string
    priority?: Priority
    assignedTo?: string | null
    dueDate?: string | null
    estimatedHours?: number | null
  },
) => post(`/api/boards/${boardId}/tasks`, input).then(j)

export const addComment = (taskId: string, content: string) => post(`/api/tasks/${taskId}/comments`, { content }).then(j)
export const deleteTask = (taskId: string) =>
  fetch(`/api/tasks/${taskId}`, { method: 'DELETE', credentials: 'same-origin' })

export const watchTask = (taskId: string, watcher: string) => post(`/api/tasks/${taskId}/watchers`, { watcher })
export const unwatchTask = (taskId: string, watcher: string) =>
  fetch(`/api/tasks/${taskId}/watchers`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ watcher }),
  })
export const reviewTask = (taskId: string, status: 'approved' | 'rejected', notes?: string) =>
  post(`/api/tasks/${taskId}/review`, { status, notes }).then(j)

export const updateTask = (
  taskId: string,
  patch: {
    title?: string
    description?: string | null
    status?: TaskStatus
    priority?: Priority
    assignedTo?: string | null
    dueDate?: string | null
    tags?: string[]
    estimatedHours?: number | null
    actualHours?: number | null
    outcome?: string | null
    resolution?: string | null
    errorMessage?: string | null
  },
) =>
  fetch(`/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(patch),
  }).then(j)

export const renameBoard = (boardId: string, name: string) =>
  fetch(`/api/boards/${boardId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ name }),
  })
export const deleteBoard = (boardId: string) =>
  fetch(`/api/boards/${boardId}`, { method: 'DELETE', credentials: 'same-origin' })
export const shareBoard = (boardId: string, email: string, role: 'editor' | 'viewer') =>
  post(`/api/boards/${boardId}/members`, { email, role })
export const unshareBoard = (boardId: string, userId: string) =>
  fetch(`/api/boards/${boardId}/members`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ userId }),
  })
