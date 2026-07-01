// Task/board constants + types — shared by client and server (no server deps).

export const TASK_STATUSES = ['inbox', 'assigned', 'in_progress', 'quality_review', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number] | 'failed' | 'cancelled'
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type Priority = (typeof PRIORITIES)[number]

export interface Task {
  id: string
  boardId: string
  title: string
  description: string | null
  status: TaskStatus
  priority: Priority
  assignedTo: string | null
  createdBy: string
  result: string | null
  createdAt: string
  updatedAt: string
}

export const STATUS_LABEL: Record<string, string> = {
  inbox: 'Inbox',
  assigned: 'Assigned',
  in_progress: 'In progress',
  quality_review: 'Quality review',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export const PRIORITY_COLOR: Record<Priority, string> = {
  low: 'var(--theme-muted)',
  medium: 'var(--theme-accent)',
  high: 'var(--theme-warning)',
  urgent: 'var(--theme-danger)',
}
