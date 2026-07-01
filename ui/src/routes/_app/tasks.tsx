import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Panel } from '@/components/ui/panel'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { useBoards, useBoardTasks } from '@/lib/boards'
import { PRIORITY_COLOR, STATUS_LABEL } from '@/lib/task-const'
import { relativeTime } from '@/lib/fleet'

export const Route = createFileRoute('/_app/tasks')({
  component: TasksList,
})

function TasksList() {
  const { data: boards = [] } = useBoards()
  const [boardId, setBoardId] = useState<string | null>(null)
  useEffect(() => {
    if (!boardId && boards[0]) setBoardId(boards[0].id)
  }, [boards, boardId])
  const { data: tasks = [] } = useBoardTasks(boardId)

  if (boards.length === 0) {
    return <EmptyState icon="☰" title="No boards yet" hint="Create one on the Swarm view to track tasks." />
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="mercury-text text-2xl font-semibold">Tasks</h1>
          <Select value={boardId ?? ''} onChange={(e) => setBoardId(e.target.value)} className="h-9">
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>

        {tasks.length === 0 ? (
          <EmptyState icon="☰" title="No tasks on this board" hint="Add cards from the Swarm view." />
        ) : (
          <Panel className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-card2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Task</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Priority</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Assignee</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {tasks.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-card">
                    <td className="px-4 py-2.5 text-fg">{t.title}</td>
                    <td className="px-4 py-2.5 text-muted">{STATUS_LABEL[t.status]}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_COLOR[t.priority] }} />
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{t.assignedTo ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-muted">{relativeTime(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </div>
    </div>
  )
}
