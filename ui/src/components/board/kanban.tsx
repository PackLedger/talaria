import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { useAgents } from '@/lib/agents'
import { createTask, updateTask, useBoardTasks, type Board } from '@/lib/boards'
import { PRIORITY_COLOR, STATUS_LABEL, TASK_STATUSES, type Task, type TaskStatus } from '@/lib/task-const'

const COL_ACCENT: Record<string, string> = {
  inbox: 'var(--theme-muted)',
  assigned: 'var(--theme-accent)',
  in_progress: 'var(--theme-warning)',
  quality_review: 'var(--theme-accent-secondary)',
  done: 'var(--theme-success)',
}

// Kanban board — polished columns with per-column add and rich cards.
export function Kanban({ board, onOpen }: { board: Board; onOpen: (taskId: string) => void }) {
  const qc = useQueryClient()
  const { data: tasks = [] } = useBoardTasks(board.id)
  const { data: fleet } = useAgents()
  const agents = fleet?.agents ?? []
  const label = (id: string | null) => agents.find((a) => a.id === id)?.label ?? id
  const canEdit = board.role === 'owner' || board.role === 'editor'
  const invalidate = () => qc.invalidateQueries({ queryKey: ['board-tasks', board.id] })

  const addTo = async (status: TaskStatus, title: string) => {
    const { task } = await createTask(board.id, { title })
    if (status !== 'inbox') await updateTask(task.id, { status })
    invalidate()
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {TASK_STATUSES.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col)
        return (
          <div key={col} className="flex w-72 shrink-0 flex-col rounded-xl bg-sidebar/60">
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="h-2 w-2 rounded-full" style={{ background: COL_ACCENT[col] }} />
              <span className="text-xs font-semibold uppercase tracking-wide text-fg">{STATUS_LABEL[col]}</span>
              <span className="text-xs text-muted">{colTasks.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
              {colTasks.map((t) => (
                <Card key={t.id} task={t} assignee={label(t.assignedTo)} onOpen={() => onOpen(t.id)} />
              ))}
              {canEdit && <AddCard onAdd={(title) => addTo(col, title)} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Card({ task, assignee, onOpen }: { task: Task; assignee: string | null; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mercury-panel w-full rounded-xl p-3 text-left transition-shadow hover:shadow-[var(--theme-shadow-3)]"
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITY_COLOR[task.priority] }} />
        <div className="min-w-0 flex-1">
          {task.ticketRef && <div className="font-[var(--font-mono)] text-[10px] text-muted">{task.ticketRef}</div>}
          <div className="text-sm text-fg">{task.title}</div>
          {task.description && <div className="mt-0.5 line-clamp-2 text-xs text-muted">{task.description}</div>}
        </div>
      </div>
      {(assignee || task.dueDate || task.tags.length > 0) && (
        <div className="mt-2 flex items-center gap-2">
          {assignee && (
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <Avatar name={assignee} className="h-4 w-4" />
              {assignee}
            </span>
          )}
          {task.dueDate && <span className="text-[11px] text-muted">· {task.dueDate.slice(0, 10)}</span>}
          {task.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-full border border-line-subtle px-1.5 text-[10px] text-muted">
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}

function AddCard({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const submit = () => {
    const t = title.trim()
    if (!t) return setOpen(false)
    setTitle('')
    onAdd(t)
  }
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-card hover:text-fg"
      >
        + Add card
      </button>
    )
  return (
    <Input
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => (e.key === 'Enter' ? submit() : e.key === 'Escape' ? setOpen(false) : null)}
      onBlur={submit}
      placeholder="Card title…"
      className="h-9 w-full text-sm"
    />
  )
}
