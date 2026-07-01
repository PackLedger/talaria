import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { WingMark } from '@/components/brand'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { TeamsModal } from '@/components/board/teams-modal'
import { cn } from '@/lib/cn'
import { NAV } from '@/lib/nav'
import { createBoard, useBoards, type Board } from '@/lib/boards'
import { useTeams } from '@/lib/teams'
import type { SessionUser } from '@/lib/session'

// The main application menu. The Boards item expands to the user's boards
// (grouped by team) when that section is active.
export function NavRail({ user }: { user: SessionUser }) {
  const isAdmin = user.role === 'admin'
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [creating, setCreating] = useState(false)
  const [teamsOpen, setTeamsOpen] = useState(false)

  return (
    <nav className="flex h-full w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line-subtle bg-sidebar px-2 py-4">
      {NAV.map((section) => {
        const items = section.items.filter((i) => !i.adminOnly || isAdmin)
        if (items.length === 0) return null
        return (
          <div key={section.title}>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{section.title}</div>
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
                    <BoardsSublist activePath={pathname} onNew={() => setCreating(true)} onTeams={() => setTeamsOpen(true)} />
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
      <TeamsModal open={teamsOpen} onClose={() => setTeamsOpen(false)} />
    </nav>
  )
}

function BoardsSublist({ activePath, onNew, onTeams }: { activePath: string; onNew: () => void; onTeams: () => void }) {
  const { data: boards = [] } = useBoards()

  // Group by team (personal boards first).
  const groups = new Map<string, Board[]>()
  for (const b of boards) {
    const key = b.teamName ?? 'Personal'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(b)
  }
  const ordered = [...groups.entries()].sort((a, b) => (a[0] === 'Personal' ? -1 : b[0] === 'Personal' ? 1 : a[0].localeCompare(b[0])))

  return (
    <div className="ml-3 mt-0.5 space-y-2 border-l border-line-subtle pl-2">
      {ordered.map(([group, gboards]) => (
        <div key={group}>
          <div className="px-2 text-[9px] font-semibold uppercase tracking-wider text-muted opacity-70">{group}</div>
          <ul className="space-y-0.5">
            {gboards.map((b) => (
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
          </ul>
        </div>
      ))}
      <div className="flex flex-col gap-0.5">
        <button onClick={onNew} className="w-full rounded-md px-2 py-1 text-left text-xs text-muted transition-colors hover:text-accent">+ New board</button>
        <button onClick={onTeams} className="w-full rounded-md px-2 py-1 text-left text-xs text-muted transition-colors hover:text-accent">Manage teams</button>
      </div>
    </div>
  )
}

function CreateBoardModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: teams = [] } = useTeams()
  const [name, setName] = useState('')
  const [teamId, setTeamId] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    const n = name.trim()
    if (!n) return
    setBusy(true)
    try {
      const { board } = await createBoard(n, teamId || null)
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
      <div className="space-y-3">
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="e.g. Q3 Launch" className="w-full" />
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Owner</span>
          <Select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="h-9 w-full">
            <option value="">Personal</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </label>
      </div>
    </Modal>
  )
}
