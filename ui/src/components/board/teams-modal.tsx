import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/cn'
import { addTeamMember, createTeam, removeTeamMember, useTeamMembers, useTeams, type TeamRole } from '@/lib/teams'

// Create teams and manage their members. Team members can access all of a team's
// boards.
export function TeamsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: teams = [] } = useTeams()
  const [selected, setSelected] = useState<string | null>(null)
  const [newTeam, setNewTeam] = useState('')

  const team = teams.find((t) => t.id === selected) ?? teams[0] ?? null
  const activeId = team?.id ?? null

  const create = async () => {
    const n = newTeam.trim()
    if (!n) return
    setNewTeam('')
    const { team: t } = await createTeam(n)
    await qc.invalidateQueries({ queryKey: ['teams'] })
    setSelected(t.id)
  }

  return (
    <Modal open={open} onClose={onClose} title="Teams" width="max-w-2xl">
      <div className="flex gap-4">
        {/* Team list */}
        <div className="w-44 shrink-0 space-y-1 border-r border-line-subtle pr-3">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-card',
                t.id === activeId ? 'bg-card text-fg' : 'text-muted',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              <span className="text-xs text-muted">{t.memberCount}</span>
            </button>
          ))}
          <div className="flex gap-1 pt-1">
            <Input value={newTeam} onChange={(e) => setNewTeam(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="New team…" className="h-8 text-sm" />
            <Button size="sm" onClick={() => void create()} disabled={!newTeam.trim()}>+</Button>
          </div>
        </div>

        {/* Members of the selected team */}
        <div className="min-w-0 flex-1">
          {team ? (
            <TeamMembers teamId={activeId!} canManage={team.role === 'owner'} />
          ) : (
            <div className="grid h-40 place-items-center text-sm text-muted">Create a team to get started.</div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function TeamMembers({ teamId, canManage }: { teamId: string; canManage: boolean }) {
  const qc = useQueryClient()
  const { data: members = [] } = useTeamMembers(teamId)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('member')
  const [err, setErr] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['team-members', teamId] })

  const add = async () => {
    setErr(null)
    const res = await addTeamMember(teamId, email.trim(), role)
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!res.ok || !data.ok) return setErr(data.error ?? 'Could not add')
    setEmail('')
    refresh()
    void qc.invalidateQueries({ queryKey: ['teams'] })
  }

  return (
    <div>
      {canManage && (
        <div className="flex items-center gap-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@email.com" className="h-9 flex-1 text-sm" />
          <Select value={role} onChange={(e) => setRole(e.target.value as TeamRole)} className="h-9">
            <option value="member">Member</option>
            <option value="owner">Owner</option>
          </Select>
          <Button size="sm" onClick={() => void add()} disabled={!email.trim()}>Add</Button>
        </div>
      )}
      {err && <div className="mt-1 text-xs" style={{ color: 'var(--theme-danger)' }}>{err}</div>}
      <ul className="mt-3 space-y-1">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
            <Avatar name={m.email ?? m.name} className="h-6 w-6" />
            <span className="min-w-0 flex-1 truncate text-sm text-fg">{m.email ?? m.name ?? m.userId}</span>
            <span className="text-xs text-muted">{m.role}</span>
            {canManage && m.role !== 'owner' && (
              <button onClick={() => void removeTeamMember(teamId, m.userId).then(refresh)} className="text-xs text-muted hover:text-[color:var(--theme-danger)]">
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
