import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Panel } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { Kanban } from '@/components/board/kanban'
import { TaskDetail } from '@/components/board/task-detail'
import {
  createBoard,
  shareBoard,
  unshareBoard,
  useBoardMembers,
  useBoards,
} from '@/lib/boards'

export const Route = createFileRoute('/_app/swarm')({
  component: SwarmBoard,
})

function SwarmBoard() {
  const qc = useQueryClient()
  const { data: boards = [], isLoading } = useBoards()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId && boards[0]) setSelectedId(boards[0].id)
  }, [boards, selectedId])

  const board = boards.find((b) => b.id === selectedId) ?? null

  const makeBoard = async () => {
    const name = creating.trim()
    if (!name) return
    setCreating('')
    const { board: b } = await createBoard(name)
    await qc.invalidateQueries({ queryKey: ['boards'] })
    setSelectedId(b.id)
  }

  if (isLoading) return <div className="grid h-full place-items-center text-sm text-muted">Loading boards…</div>

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle px-4 py-2.5">
        {boards.length > 0 && (
          <Select value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value)} className="h-9">
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.role !== 'owner' ? ` (${b.role})` : ''}
              </option>
            ))}
          </Select>
        )}
        <div className="flex items-center gap-1.5">
          <Input
            value={creating}
            onChange={(e) => setCreating(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && makeBoard()}
            placeholder="New board…"
            className="h-9 w-40 text-sm"
          />
          <Button size="sm" onClick={() => void makeBoard()} disabled={!creating.trim()}>
            Create
          </Button>
        </div>
        {board && board.role !== 'viewer' && (
          <Button variant="outline" size="sm" onClick={() => setShowShare((s) => !s)} className="ml-auto">
            Share
          </Button>
        )}
      </div>

      {board && showShare && <SharePanel boardId={board.id} />}

      <div className="min-h-0 flex-1">
        {board ? (
          <Kanban board={board} onOpen={setOpenTaskId} />
        ) : (
          <EmptyState icon="⧉" title="No boards yet" hint="Name one above and hit Create to start assigning work." />
        )}
      </div>

      {board && openTaskId && (
        <TaskDetail taskId={openTaskId} board={board} onClose={() => setOpenTaskId(null)} />
      )}
    </div>
  )
}

function SharePanel({ boardId }: { boardId: string }) {
  const qc = useQueryClient()
  const { data: members = [] } = useBoardMembers(boardId)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [err, setErr] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['board-members', boardId] })

  const add = async () => {
    setErr(null)
    const res = await shareBoard(boardId, email.trim(), role)
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!res.ok || !data.ok) return setErr(data.error ?? 'Could not share')
    setEmail('')
    refresh()
  }
  const remove = async (userId: string) => {
    await unshareBoard(boardId, userId)
    refresh()
  }

  return (
    <Panel className="mx-4 my-3 p-3">
      <div className="mb-2 text-sm font-semibold text-fg">Share board</div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@email"
          className="h-9 w-56 text-sm"
        />
        <Select value={role} onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')} className="h-9">
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </Select>
        <Button size="sm" onClick={() => void add()} disabled={!email.trim()}>
          Add
        </Button>
        {err && <span className="text-xs" style={{ color: 'var(--theme-danger)' }}>{err}</span>}
      </div>
      <ul className="mt-3 space-y-1">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-fg">{m.email ?? m.name ?? m.userId}</span>
            <span className="text-xs text-muted">{m.role}</span>
            {m.role !== 'owner' && (
              <button type="button" onClick={() => void remove(m.userId)} className="text-xs text-muted hover:text-[color:var(--theme-danger)]">
                remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
