import { useAgents } from '@/lib/agents'
import { PRIORITY_COLOR, STATUS_LABEL, type Task } from '@/lib/task-const'
import { relativeTime } from '@/lib/fleet'

// List view of a board's tasks (alternative to the kanban). Rows open the detail.
export function BoardList({ tasks, onOpen }: { tasks: Task[]; onOpen: (id: string) => void }) {
  const { data: fleet } = useAgents()
  const label = (id: string | null) => fleet?.agents.find((a) => a.id === id)?.label ?? id ?? '—'

  if (tasks.length === 0) {
    return <div className="grid h-full place-items-center text-sm text-muted">No tasks match.</div>
  }
  return (
    <div className="h-full overflow-auto p-4">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Ticket</th>
            <th className="px-3 py-2 text-left font-semibold">Task</th>
            <th className="px-3 py-2 text-left font-semibold">Status</th>
            <th className="px-3 py-2 text-left font-semibold">Priority</th>
            <th className="px-3 py-2 text-left font-semibold">Assignee</th>
            <th className="px-3 py-2 text-right font-semibold">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {tasks.map((t) => (
            <tr key={t.id} onClick={() => onOpen(t.id)} className="cursor-pointer transition-colors hover:bg-card">
              <td className="px-3 py-2 font-[var(--font-mono)] text-xs text-muted">{t.ticketRef ?? ''}</td>
              <td className="px-3 py-2 text-fg">{t.title}</td>
              <td className="px-3 py-2 text-muted">{STATUS_LABEL[t.status]}</td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_COLOR[t.priority] }} />
                  {t.priority}
                </span>
              </td>
              <td className="px-3 py-2 text-muted">{label(t.assignedTo)}</td>
              <td className="px-3 py-2 text-right text-muted">{relativeTime(t.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
