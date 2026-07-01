import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { WingMark } from '@/components/brand'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { NAV } from '@/lib/nav'
import { createBoard, useBoards } from '@/lib/boards'
import type { SessionUser } from '@/lib/session'

// The main application menu. The Boards item expands to the user's boards when
// that section is active (Plane/ClickUp pattern).
export function NavRail({ user }: { user: SessionUser }) {
  const isAdmin = user.role === 'admin'
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [creating, setCreating] = useState(false)

  return (
    <nav className="flex h-full w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line-subtle bg-sidebar px-2 py-4">
      {NAV.map((section) => {
        const items = section.items.filter((i) => !i.adminOnly || isAdmin)
        if (items.length === 0) return null
        return (
          <div key={section.title}>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
              {section.title}
            </div>
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    activeOptions={{ exact: item.to === '/' }}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-card hover:text-fg"
                    activeProps={{ className: 'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm bg-card text-fg [&_.nav-ico]:text-accent' }}
                  >
                    <span className="nav-ico w-4 text-center text-muted">{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.adminOnly && <span className="text-[10px] text-accent">admin</span>}
                  </Link>
                  {item.to === '/boards' && pathname.startsWith('/boards') && (
                    <BoardsSublist activePath={pathname} onNew={() => setCreating(true)} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      <div className="mt-auto flex items-center gap-2 px-2 pt-2 text-[10px] text-muted">
        <WingMark className="h-4 w-4" />
        <span>Talaria · Phase 2</span>
      </div>

      <CreateBoardModal open={creating} onClose={() => setCreating(false)} />
    </nav>
  )
}

function BoardsSublist({ activePath, onNew }: { activePath: string; onNew: () => void }) {
  const { data: boards = [] } = useBoards()
  return (
    <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-line-subtle pl-2">
      {boards.map((b) => (
        <li key={b.id}>
          <Link
            to="/boards/$boardId"
            params={{ boardId: b.id }}
            className={cn(
              'block truncate rounded-md px-2 py-1 text-xs transition-colors hover:bg-card hover:text-fg',
              activePath === `/boards/${b.id}` ? 'bg-card text-fg' : 'text-muted',
            )}
          >
            {b.name}
          </Link>
        </li>
      ))}
      <li>
        <button onClick={onNew} className="w-full rounded-md px-2 py-1 text-left text-xs text-muted transition-colors hover:text-accent">
          + New board
        </button>
      </li>
    </ul>
  )
}

function CreateBoardModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    const n = name.trim()
    if (!n) return
    setBusy(true)
    try {
      const { board } = await createBoard(n)
      setName('')
      await qc.invalidateQueries({ queryKey: ['boards'] })
      onClose()
      void navigate({ to: '/boards/$boardId', params: { boardId: board.id } })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New board"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => void create()} disabled={busy || !name.trim()}>Create board</Button>
        </div>
      }
    >
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && create()}
        placeholder="e.g. Q3 Launch"
        className="w-full"
      />
    </Modal>
  )
}
