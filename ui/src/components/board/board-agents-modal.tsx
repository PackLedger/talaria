import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { useAgents } from '@/lib/agents'
import { setBoardAgents, useBoardAgents } from '@/lib/boards'

// Pick which fleet agents may be assigned tasks on this board. None selected =
// all agents allowed (open by default).
export function BoardAgentsModal({ boardId, open, onClose }: { boardId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: fleet } = useAgents()
  const agents = fleet?.agents ?? []
  const { data: allowed = [] } = useBoardAgents(open ? boardId : null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSelected(new Set(allowed))
  }, [allowed, open])

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const save = async () => {
    setBusy(true)
    try {
      await setBoardAgents(boardId, [...selected])
      await qc.invalidateQueries({ queryKey: ['board-agents', boardId] })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agents on this board"
      footer={
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{selected.size === 0 ? 'All agents allowed' : `${selected.size} allowed`}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => void save()} disabled={busy}>Save</Button>
          </div>
        </div>
      }
    >
      <p className="mb-3 text-xs text-muted">Leave all unchecked to allow the whole fleet.</p>
      <ul className="max-h-80 space-y-0.5 overflow-y-auto">
        {agents.map((a) => (
          <li key={a.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-card">
              <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="accent-[color:var(--theme-accent)]" />
              <Avatar name={a.label} className="h-6 w-6" />
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{a.label}</span>
              <span className="text-xs text-muted">{a.role}</span>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
