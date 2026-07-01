import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { useAgents } from '@/lib/agents'
import { setBoardAgents, useBoardAgents } from '@/lib/boards'

// Configure which fleet agents may be assigned tasks on this board. Restrictive
// by default — either allow all, or pick specific agents (fuzzy search).
export function BoardAgentsModal({ boardId, open, onClose }: { boardId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: fleet } = useAgents()
  const options = (fleet?.agents ?? []).map((a) => ({ value: a.id, label: a.label, sub: a.role }))
  const { data: config } = useBoardAgents(open ? boardId : null)
  const [allowAll, setAllowAll] = useState(false)
  const [agents, setAgents] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (config) {
      setAllowAll(config.allowAll)
      setAgents(config.models)
    }
  }, [config, open])

  const save = async () => {
    setBusy(true)
    try {
      await setBoardAgents(boardId, allowAll, allowAll ? [] : agents)
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
          <span className="text-xs text-muted">{allowAll ? 'All agents allowed' : `${agents.length} allowed`}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => void save()} disabled={busy}>Save</Button>
          </div>
        </div>
      }
    >
      <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-fg">
        <input type="checkbox" checked={allowAll} onChange={(e) => setAllowAll(e.target.checked)} className="accent-[color:var(--theme-accent)]" />
        Allow all agents
      </label>
      {!allowAll && <Combobox options={options} selected={agents} onChange={setAgents} multiple placeholder="Select agents…" />}
    </Modal>
  )
}
