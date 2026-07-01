import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Avatar } from '@/components/ui/avatar'
import { shareBoard, unshareBoard, useBoardMembers } from '@/lib/boards'

export function ShareModal({
  boardId,
  boardName,
  open,
  onClose,
}: {
  boardId: string
  boardName: string
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: members = [] } = useBoardMembers(open ? boardId : null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: ['board-members', boardId] })

  const invite = async () => {
    setErr(null)
    setBusy(true)
    try {
      const res = await shareBoard(boardId, email.trim(), role)
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) return setErr(data.error ?? 'Could not share')
      setEmail('')
      refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Share “${boardName}”`} width="max-w-lg">
      <div className="flex items-center gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && invite()}
          placeholder="teammate@email.com"
          className="h-9 flex-1"
        />
        <Select value={role} onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')} className="h-9">
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </Select>
        <Button size="sm" onClick={() => void invite()} disabled={busy || !email.trim()}>
          Invite
        </Button>
      </div>
      {err && <div className="mt-2 text-xs" style={{ color: 'var(--theme-danger)' }}>{err}</div>}

      <div className="mt-4 space-y-1">
        <div className="mb-1 text-xs uppercase tracking-wide text-muted">People with access</div>
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
            <Avatar name={m.email ?? m.name} className="h-7 w-7" />
            <span className="min-w-0 flex-1 truncate text-sm text-fg">{m.email ?? m.name ?? m.userId}</span>
            <span className="text-xs text-muted">{m.role}</span>
            {m.role !== 'owner' && (
              <button
                onClick={() => {
                  void unshareBoard(boardId, m.userId).then(refresh)
                }}
                className="text-xs text-muted hover:text-[color:var(--theme-danger)]"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}
