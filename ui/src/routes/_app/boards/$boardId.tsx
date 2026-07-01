import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { BoardHeader } from '@/components/board/board-header'
import { Kanban } from '@/components/board/kanban'
import { BoardList } from '@/components/board/board-list'
import { TaskDetail } from '@/components/board/task-detail'
import { ShareModal } from '@/components/board/share-modal'
import { BoardAgentsModal } from '@/components/board/board-agents-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/cn'
import { useAgents } from '@/lib/agents'
import { useBoards, useBoardTasks } from '@/lib/boards'
import { PRIORITIES } from '@/lib/task-const'

export const Route = createFileRoute('/_app/boards/$boardId')({
  component: BoardPage,
})

function BoardPage() {
  const { boardId } = Route.useParams()
  const { data: boards = [], isLoading } = useBoards()
  const board = boards.find((b) => b.id === boardId)
  const { data: allTasks = [] } = useBoardTasks(board ? boardId : null)
  const { data: fleet } = useAgents()

  const [share, setShare] = useState(false)
  const [agentsOpen, setAgentsOpen] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [view, setView] = useState<'board' | 'list'>('board')
  const [q, setQ] = useState('')
  const [assignee, setAssignee] = useState('')
  const [priority, setPriority] = useState('')

  const tasks = useMemo(() => {
    const query = q.trim().toLowerCase()
    return allTasks.filter(
      (t) =>
        (!query || t.title.toLowerCase().includes(query) || (t.ticketRef ?? '').toLowerCase().includes(query)) &&
        (!assignee || t.assignedTo === assignee) &&
        (!priority || t.priority === priority),
    )
  }, [allTasks, q, assignee, priority])

  if (isLoading) return <div className="grid h-full place-items-center text-sm text-muted">Loading…</div>
  if (!board) return <EmptyState icon="⧉" title="Board not found" hint="It may have been deleted, or you don’t have access." />

  const toggleCls = (active: boolean) =>
    cn('rounded-md px-2 py-1 text-xs transition-colors', active ? 'bg-card text-fg' : 'text-muted hover:text-fg')

  return (
    <div className="flex h-full flex-col">
      <BoardHeader board={board} onShare={() => setShare(true)} onAgents={() => setAgentsOpen(true)} />

      {/* Toolbar: view toggle + filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle px-5 py-2">
        <div className="flex rounded-lg border border-line p-0.5">
          <button className={toggleCls(view === 'board')} onClick={() => setView('board')}>Board</button>
          <button className={toggleCls(view === 'list')} onClick={() => setView('list')}>List</button>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 w-44 text-sm" />
        <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-8">
          <option value="">Any assignee</option>
          {(fleet?.agents ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-8">
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Select>
        <span className="ml-auto text-xs text-muted">{tasks.length} of {allTasks.length}</span>
      </div>

      <div className="min-h-0 flex-1">
        {view === 'board' ? (
          <Kanban board={board} tasks={tasks} onOpen={setOpenTaskId} />
        ) : (
          <BoardList tasks={tasks} onOpen={setOpenTaskId} />
        )}
      </div>

      <ShareModal boardId={board.id} boardName={board.name} open={share} onClose={() => setShare(false)} />
      <BoardAgentsModal boardId={board.id} open={agentsOpen} onClose={() => setAgentsOpen(false)} />
      {openTaskId && <TaskDetail taskId={openTaskId} board={board} onClose={() => setOpenTaskId(null)} />}
    </div>
  )
}
