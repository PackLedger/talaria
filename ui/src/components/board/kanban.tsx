import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useAgents } from '@/lib/agents'
import { createTask, updateTask, useBoardTasks, type Board } from '@/lib/boards'
import { PRIORITY_COLOR, STATUS_LABEL, TASK_STATUSES, type Task, type TaskStatus } from '@/lib/task-const'

const MOVE_OPTIONS: TaskStatus[] = [...TASK_STATUSES, 'failed', 'cancelled']

// Kanban board for one board's tasks. Columns are statuses; agents can be
// assigned per card. Editors+ can create/move/assign; viewers are read-only.
export function Kanban({ board }: { board: Board }) {
  const qc = useQueryClient()
  const { data: tasks = [] } = useBoardTasks(board.id)
  const { data: fleet } = useAgents()
  const agents = fleet?.agents ?? []
  const canEdit = board.role === 'owner' || board.role === 'editor'
  const invalidate = () => qc.invalidateQueries({ queryKey: ['board-tasks', board.id] })

  const [newTitle, setNewTitle] = useState('')
  const addCard = async () => {
    const title = newTitle.trim()
    if (!title) return
    setNewTitle('')
    await createTask(board.id, { title })
    invalidate()
  }
  const move = async (t: Task, status: TaskStatus) => {
    await updateTask(t.id, { status })
    invalidate()
  }
  const assign = async (t: Task, assignedTo: string) => {
    await updateTask(t.id, { assignedTo: assignedTo || null })
    invalidate()
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {TASK_STATUSES.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col)
        return (
          <div key={col} className="flex w-72 shrink-0 flex-col">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">{STATUS_LABEL[col]}</span>
              <span className="text-xs text-muted">{colTasks.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {colTasks.map((t) => (
                <div key={t.id} className="mercury-panel rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITY_COLOR[t.priority] }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-fg">{t.title}</div>
                      {t.description && <div className="mt-0.5 line-clamp-2 text-xs text-muted">{t.description}</div>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="mt-2 flex gap-1.5">
                      <Select value={t.status} onChange={(e) => move(t, e.target.value as TaskStatus)} className="min-w-0 flex-1">
                        {MOVE_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </Select>
                      <Select value={t.assignedTo ?? ''} onChange={(e) => assign(t, e.target.value)} className="min-w-0 flex-1">
                        <option value="">Unassigned</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              ))}
              {col === 'inbox' && canEdit && (
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addCard()
                  }}
                  placeholder="Add a card…"
                  className="h-9 w-full text-sm"
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
