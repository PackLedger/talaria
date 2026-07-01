import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Panel } from '@/components/ui/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { useAgents } from '@/lib/agents'
import { createTask, useBoards, useBoardTasks } from '@/lib/boards'
import { STATUS_LABEL } from '@/lib/task-const'
import { relativeTime } from '@/lib/fleet'

export const Route = createFileRoute('/_app/missions')({
  component: Missions,
})

function Missions() {
  const qc = useQueryClient()
  const { data: boards = [] } = useBoards()
  const { data: fleet } = useAgents()
  const agents = fleet?.agents ?? []
  const [boardId, setBoardId] = useState<string | null>(null)
  useEffect(() => {
    if (!boardId && boards[0]) setBoardId(boards[0].id)
  }, [boards, boardId])
  const { data: tasks = [] } = useBoardTasks(boardId)

  const noBoards = boards.length === 0

  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [assignee, setAssignee] = useState('')
  const [busy, setBusy] = useState(false)

  const launch = async () => {
    if (!boardId || !title.trim()) return
    setBusy(true)
    try {
      await createTask(boardId, {
        title: title.trim(),
        description: prompt.trim() || undefined,
        assignedTo: assignee || null,
      })
      setTitle('')
      setPrompt('')
      await qc.invalidateQueries({ queryKey: ['board-tasks', boardId] })
    } finally {
      setBusy(false)
    }
  }

  if (noBoards) {
    return <EmptyState icon="◎" title="No boards yet" hint="Create one on the Swarm view to launch missions." />
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="mercury-text text-2xl font-semibold">Missions</h1>
        {(
          <>
            <Panel className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-muted">Board</span>
                <Select value={boardId ?? ''} onChange={(e) => setBoardId(e.target.value)} className="h-9">
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mission title" className="w-full" />
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What should the agent do?"
                rows={4}
                className="w-full"
              />
              <div className="flex items-center justify-between gap-2">
                <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-9">
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </Select>
                <Button onClick={() => void launch()} disabled={busy || !title.trim()}>
                  {busy ? 'Launching…' : 'Launch mission'}
                </Button>
              </div>
            </Panel>

            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-muted">Recent missions</div>
              <ul className="space-y-1">
                {tasks.slice(0, 12).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-card">
                    <span className="min-w-0 flex-1 truncate text-sm text-fg">{t.title}</span>
                    <span className="text-xs text-muted">{STATUS_LABEL[t.status]}</span>
                    {t.assignedTo && <span className="text-xs text-accent">{t.assignedTo}</span>}
                    <span className="w-16 text-right text-xs text-muted">{relativeTime(t.updatedAt)}</span>
                  </li>
                ))}
                {tasks.length === 0 && <li className="px-2 text-sm text-muted">No missions yet.</li>}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
