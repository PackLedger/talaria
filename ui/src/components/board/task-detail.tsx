import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Markdown } from '@/components/ui/markdown'
import { useAgents } from '@/lib/agents'
import { useSession } from '@/lib/session'
import {
  addComment,
  deleteTask,
  reviewTask,
  unwatchTask,
  updateTask,
  useBoardAgents,
  useTask,
  watchTask,
  type Board,
} from '@/lib/boards'
import { PRIORITIES, PRIORITY_ICON, STATUS_LABEL, TASK_STATUSES, type Priority, type TaskStatus } from '@/lib/task-const'
import { relativeTime } from '@/lib/fleet'

const MOVE: TaskStatus[] = [...TASK_STATUSES, 'failed', 'cancelled']

// Linear/Plane-style ticket: content (left) + properties rail (right).
export function TaskDetail({ taskId, board, onClose }: { taskId: string; board: Board; onClose: () => void }) {
  const qc = useQueryClient()
  const { data } = useTask(taskId)
  const { data: fleet } = useAgents()
  const { data: user } = useSession()
  const { data: boardAgents = [] } = useBoardAgents(board.id)
  const allAgents = fleet?.agents ?? []
  // Restrict the assignee list to the board's allowed agents (empty ⇒ all).
  const agents = boardAgents.length ? allAgents.filter((a) => boardAgents.includes(a.id)) : allAgents
  const canEdit = board.role === 'owner' || board.role === 'editor'
  const me = user?.email ?? user?.name ?? ''

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (data?.task) {
      setTitle(data.task.title)
      setDescription(data.task.description ?? '')
      setTags(data.task.tags.join(', '))
    }
  }, [data?.task])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['task', taskId] })
    void qc.invalidateQueries({ queryKey: ['board-tasks', board.id] })
  }
  const save = async (patch: Parameters<typeof updateTask>[1]) => {
    await updateTask(taskId, patch)
    refresh()
  }
  const t = data?.task

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 grid place-items-center p-4">
        <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.16 }}
          className="mercury-panel relative z-10 flex h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl"
        >
          {!t ? (
            <div className="grid h-full w-full place-items-center text-sm text-muted">Loading…</div>
          ) : (
            <>
              {/* Content */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2 border-b border-line-subtle px-5 py-2.5">
                  {t.ticketRef && <span className="font-[var(--font-mono)] text-xs text-muted">{t.ticketRef}</span>}
                  <span className="text-xs text-muted">·</span>
                  <span className="text-xs text-muted">opened by {t.createdBy}</span>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
                  <Input
                    value={title}
                    disabled={!canEdit}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => title.trim() && title !== t.title && save({ title: title.trim() })}
                    className="border-0 bg-transparent px-0 text-lg font-semibold focus:border-0"
                  />

                  {/* Approval gate */}
                  {t.status === 'quality_review' && canEdit && (
                    <div className="flex items-center gap-2 rounded-lg border border-[color:var(--theme-accent-border)] bg-accent-soft p-2 text-sm">
                      <span className="flex-1 text-fg">Ready for review — approve to complete.</span>
                      <Button size="sm" onClick={async () => { await reviewTask(taskId, 'approved'); refresh() }}>Approve</Button>
                      <Button variant="outline" size="sm" onClick={async () => { await reviewTask(taskId, 'rejected'); refresh() }}>Request changes</Button>
                    </div>
                  )}

                  <Section label="Description">
                    <Textarea
                      rows={4}
                      value={description}
                      disabled={!canEdit}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => description !== (t.description ?? '') && save({ description: description || null })}
                      placeholder="Add detail…"
                      className="w-full"
                    />
                  </Section>

                  {/* Agent-reported result */}
                  {(t.outcome || t.resolution || t.errorMessage) && (
                    <Section label="Result">
                      {t.outcome && <ResultBlock title="Outcome">{t.outcome}</ResultBlock>}
                      {t.resolution && <ResultBlock title="Resolution">{t.resolution}</ResultBlock>}
                      {t.errorMessage && <ResultBlock title="Error" danger>{t.errorMessage}</ResultBlock>}
                    </Section>
                  )}

                  <Section label={`Comments (${data!.comments.length})`}>
                    <ul className="space-y-2">
                      {data!.comments.map((c) => (
                        <li key={c.id} className="rounded-lg border border-line-subtle bg-card p-2">
                          <div className="mb-0.5 flex items-center justify-between text-xs">
                            <span className="text-accent">{c.author}</span>
                            <span className="text-muted">{relativeTime(c.createdAt)}</span>
                          </div>
                          <div className="text-sm text-fg"><Markdown>{c.content}</Markdown></div>
                        </li>
                      ))}
                      {data!.comments.length === 0 && <li className="text-xs text-muted">No comments yet.</li>}
                    </ul>
                    <div className="mt-2 flex gap-1.5">
                      <Input value={comment} onChange={(e) => setComment(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && comment.trim()) { const c = comment.trim(); setComment(''); addComment(taskId, c).then(refresh) } }}
                        placeholder="Comment…" className="h-9 flex-1 text-sm" />
                      <Button size="sm" disabled={!comment.trim()} onClick={() => { const c = comment.trim(); setComment(''); void addComment(taskId, c).then(refresh) }}>Send</Button>
                    </div>
                  </Section>

                  <Section label="Activity">
                    <ul className="space-y-1">
                      {data!.activity.map((a) => (
                        <li key={a.id} className="flex items-center gap-2 text-xs text-muted">
                          <span className="text-accent">{a.actor}</span>
                          <span className="min-w-0 flex-1 truncate">{a.description}</span>
                          <span>{relativeTime(a.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                </div>
              </div>

              {/* Properties rail */}
              <aside className="w-60 shrink-0 space-y-4 overflow-y-auto border-l border-line-subtle bg-sidebar p-4">
                <button onClick={onClose} className="ml-auto block text-muted hover:text-fg" aria-label="Close">✕</button>
                <Prop label="Status">
                  <Select value={t.status} disabled={!canEdit} onChange={(e) => save({ status: e.target.value as TaskStatus })} className="w-full">
                    {MOVE.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </Select>
                </Prop>
                <Prop label="Priority">
                  <Select value={t.priority} disabled={!canEdit} onChange={(e) => save({ priority: e.target.value as Priority })} className="w-full">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_ICON[p]} {p}</option>)}
                  </Select>
                </Prop>
                <Prop label="Assignee">
                  <Select value={t.assignedTo ?? ''} disabled={!canEdit} onChange={(e) => save({ assignedTo: e.target.value || null })} className="w-full">
                    <option value="">Unassigned</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </Select>
                </Prop>
                <Prop label="Due date">
                  <Input type="date" value={t.dueDate ? t.dueDate.slice(0, 10) : ''} disabled={!canEdit}
                    onChange={(e) => save({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="h-8 w-full text-sm" />
                </Prop>
                <div className="grid grid-cols-2 gap-2">
                  <Prop label="Estimate (h)">
                    <Input type="number" min="0" value={t.estimatedHours ?? ''} disabled={!canEdit}
                      onBlur={(e) => save({ estimatedHours: e.target.value ? Number(e.target.value) : null })}
                      className="h-8 w-full text-sm" />
                  </Prop>
                  <Prop label="Actual (h)">
                    <Input type="number" min="0" value={t.actualHours ?? ''} disabled={!canEdit}
                      onBlur={(e) => save({ actualHours: e.target.value ? Number(e.target.value) : null })}
                      className="h-8 w-full text-sm" />
                  </Prop>
                </div>
                <Prop label="Labels">
                  <Input value={tags} disabled={!canEdit} onChange={(e) => setTags(e.target.value)}
                    onBlur={() => save({ tags: tags.split(',').map((s) => s.trim()).filter(Boolean) })}
                    placeholder="comma, separated" className="h-8 w-full text-sm" />
                </Prop>
                <Prop label={`Watchers (${data!.watchers.length})`}>
                  <div className="space-y-1">
                    {data!.watchers.map((w) => <div key={w} className="truncate text-xs text-muted">{w}</div>)}
                    {me && (
                      <button className="text-xs text-accent hover:underline"
                        onClick={async () => { data!.watchers.includes(me) ? await unwatchTask(taskId, me) : await watchTask(taskId, me); refresh() }}>
                        {data!.watchers.includes(me) ? 'Unwatch' : 'Watch'}
                      </button>
                    )}
                  </div>
                </Prop>

                <div className="space-y-1 border-t border-line-subtle pt-3 text-[11px] text-muted">
                  <div>Created {relativeTime(t.createdAt)}</div>
                  <div>Updated {relativeTime(t.updatedAt)}</div>
                  {t.completedAt && <div>Completed {relativeTime(t.completedAt)}</div>}
                </div>

                {canEdit && (
                  <button onClick={async () => { await deleteTask(taskId); refresh(); onClose() }}
                    className="text-xs text-muted hover:text-[color:var(--theme-danger)]">Delete task</button>
                )}
              </aside>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      {children}
    </div>
  )
}
function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">{label}</div>
      {children}
    </div>
  )
}
function ResultBlock({ title, danger, children }: { title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-2 rounded-lg border border-line-subtle bg-card p-2">
      <div className="mb-0.5 text-[11px] uppercase tracking-wide" style={danger ? { color: 'var(--theme-danger)' } : undefined}>{title}</div>
      <div className="whitespace-pre-wrap text-sm text-fg">{children}</div>
    </div>
  )
}
