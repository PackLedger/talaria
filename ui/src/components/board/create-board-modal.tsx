import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/cn'
import { useAgents } from '@/lib/agents'
import { useTeams } from '@/lib/teams'
import { createBoard, setBoardAgents, shareBoard } from '@/lib/boards'

type Invite = { email: string; role: 'editor' | 'viewer' }

// Create a board and configure everything up front: owner (personal/team),
// which agents may work it, and who to invite.
export function CreateBoardModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: fleet } = useAgents()
  const { data: teams = [] } = useTeams()
  const agents = fleet?.agents ?? []

  const [name, setName] = useState('')
  const [teamId, setTeamId] = useState('')
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [invites, setInvites] = useState<Invite[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setName('')
    setTeamId('')
    setSelectedAgents(new Set())
    setInvites([])
    setEmail('')
  }
  const close = () => {
    reset()
    onClose()
  }

  const toggleAgent = (id: string) =>
    setSelectedAgents((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  const addInvite = () => {
    const e = email.trim().toLowerCase()
    if (!e || invites.some((i) => i.email === e)) return
    setInvites((prev) => [...prev, { email: e, role }])
    setEmail('')
  }

  const create = async () => {
    const n = name.trim()
    if (!n) return
    setBusy(true)
    try {
      const { board } = await createBoard(n, teamId || null)
      if (selectedAgents.size) await setBoardAgents(board.id, [...selectedAgents])
      for (const inv of invites) await shareBoard(board.id, inv.email, inv.role).catch(() => {})
      await qc.invalidateQueries({ queryKey: ['boards'] })
      close()
      void navigate({ to: '/boards/$boardId', params: { boardId: board.id } })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New board"
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{selectedAgents.size === 0 ? 'All agents allowed' : `${selectedAgents.size} agents`}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={close}>Cancel</Button>
            <Button size="sm" onClick={() => void create()} disabled={busy || !name.trim()}>Create board</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="e.g. Q3 Launch" className="w-full" />
        </Field>

        <Field label="Owner">
          <Select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="h-9 w-full">
            <option value="">Personal</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Agents" hint="Leave all unchecked to allow the whole fleet.">
          <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-line-subtle p-1">
            {agents.map((a) => (
              <li key={a.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-card">
                  <input type="checkbox" checked={selectedAgents.has(a.id)} onChange={() => toggleAgent(a.id)} className="accent-[color:var(--theme-accent)]" />
                  <Avatar name={a.label} className="h-5 w-5" />
                  <span className="min-w-0 flex-1 truncate text-sm text-fg">{a.label}</span>
                  <span className="text-xs text-muted">{a.role}</span>
                </label>
              </li>
            ))}
          </ul>
        </Field>

        <Field label="Invite (optional)">
          <div className="flex items-center gap-2">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addInvite()} placeholder="teammate@email.com" className="h-9 flex-1 text-sm" />
            <Select value={role} onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')} className="h-9">
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </Select>
            <Button variant="outline" size="sm" onClick={addInvite} disabled={!email.trim()}>Add</Button>
          </div>
          {invites.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {invites.map((i) => (
                <span key={i.email} className={cn('flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-muted')}>
                  {i.email} · {i.role}
                  <button onClick={() => setInvites((prev) => prev.filter((x) => x.email !== i.email))} className="hover:text-[color:var(--theme-danger)]">✕</button>
                </span>
              ))}
            </div>
          )}
        </Field>
      </div>
    </Modal>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
        {hint && <span className="text-[11px] text-muted opacity-70">{hint}</span>}
      </div>
      {children}
    </label>
  )
}
