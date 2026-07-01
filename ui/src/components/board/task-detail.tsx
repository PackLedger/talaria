import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { useAgents } from '@/lib/agents'
import { addComment, deleteTask, updateTask, useTask, type Board } from '@/lib/boards'
import { PRIORITIES, STATUS_LABEL, TASK_STATUSES, type Priority, type TaskStatus } from '@/lib/task-const'
import { relativeTime } from '@/lib/fleet'

const MOVE: TaskStatus[] = [...TASK_STATUSES, 'failed', 'cancelled']

// Slide-in task detail: edit fields, discuss (comments), and audit (activity).
export function TaskDetail({ taskId, board, onClose }: { taskId: string; board: Board; onClose: () => void }) {
  const qc = useQueryClient()
  const { data } = useTask(taskId)
  const { data: fleet } = useAgents()
  const agents = fleet?.agents ?? []
  const canEdit = board.role === 'owner' || board.role === 'editor'

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (data?.task) {
      setTitle(data.task.title)
      setDescription(data.task.description ?? '')
    }
  }, [data?.task])

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['task', taskId] })
    void qc.invalidateQueries({ queryKey: ['board-tasks', board.id] })
  }
  const save = async (patch: Parameters<typeof updateTask>[1]) => {
    await updateTask(taskId, patch)
    refresh()
  }
  const submitComment = async () => {
    const c = comment.trim()
    if (!c) return
    setComment('')
    await addComment(taskId, c)
    refresh()
  }
  const remove = async () => {
    await deleteTask(taskId)
    refresh()
    onClose()
  }

  const t = data?.task
  const dueValue = t?.dueDate ? t.dueDate.slice(0, 10) : ''

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex justify-end">
        <motion.div
          className="absolute inset-0 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.aside
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 flex h-full w-[30rem] max-w-full flex-col border-l border-line theme-panel"
        >
          {!t ? (
            <div className="grid h-full place-items-center text-sm text-muted">Loading…</div>
          ) : (
            <>
              <div className="flex items-start gap-2 border-b border-line-subtle p-4">
                <Input
                  value={title}
                  disabled={!canEdit}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => title.trim() && title !== t.title && save({ title: title.trim() })}
                  className="flex-1 border-0 bg-transparent px-0 text-base font-semibold focus:border-0"
                />
                <button onClick={onClose} className="text-muted hover:text-fg" aria-label="Close">✕</button>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Status">
                    <Select value={t.status} disabled={!canEdit} onChange={(e) => save({ status: e.target.value as TaskStatus })} className="w-full">
                      {MOVE.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </Select>
                  </Field>
                  <Field label="Priority">
                    <Select value={t.priority} disabled={!canEdit} onChange={(e) => save({ priority: e.target.value as Priority })} className="w-full">
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </Select>
                  </Field>
                  <Field label="Assignee">
                    <Select value={t.assignedTo ?? ''} disabled={!canEdit} onChange={(e) => save({ assignedTo: e.target.value || null })} className="w-full">
                      <option value="">Unassigned</option>
                      {agents.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Due">
                    <Input
                      type="date"
                      value={dueValue}
                      disabled={!canEdit}
                      onChange={(e) => save({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      className="h-8 w-full text-sm"
                    />
                  </Field>
                </div>

                <Field label="Description">
                  <Textarea
                    rows={4}
                    value={description}
                    disabled={!canEdit}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => description !== (t.description ?? '') && save({ description: description || null })}
                    placeholder="Add detail…"
                    className="w-full"
                  />
                </Field>

                {t.result && (
                  <Field label="Result">
                    <div className="rounded-lg border border-line-subtle bg-card p-2 text-sm text-fg">{t.result}</div>
                  </Field>
                )}

                {/* Comments */}
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wide text-muted">Comments</div>
                  <ul className="space-y-2">
                    {data!.comments.map((c) => (
                      <li key={c.id} className="rounded-lg border border-line-subtle bg-card p-2">
                        <div className="mb-0.5 flex items-center justify-between text-xs">
                          <span className="text-accent">{c.author}</span>
                          <span className="text-muted">{relativeTime(c.createdAt)}</span>
                        </div>
                        <div className="whitespace-pre-wrap text-sm text-fg">{c.content}</div>
                      </li>
                    ))}
                    {data!.comments.length === 0 && <li className="text-xs text-muted">No comments yet.</li>}
                  </ul>
                  <div className="mt-2 flex gap-1.5">
                    <Input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                      placeholder="Add a comment…"
                      className="h-9 flex-1 text-sm"
                    />
                    <Button size="sm" onClick={() => void submitComment()} disabled={!comment.trim()}>Send</Button>
                  </div>
                </div>

                {/* Activity */}
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wide text-muted">Activity</div>
                  <ul className="space-y-1">
                    {data!.activity.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-xs text-muted">
                        <span className="text-accent">{a.actor}</span>
                        <span className="min-w-0 flex-1 truncate">{a.description}</span>
                        <span>{relativeTime(a.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {canEdit && (
                <div className="border-t border-line-subtle p-3">
                  <button onClick={() => void remove()} className="text-xs text-muted hover:text-[color:var(--theme-danger)]">
                    Delete task
                  </button>
                </div>
              )}
            </>
          )}
        </motion.aside>
      </div>
    </AnimatePresence>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs uppercase tracking-wide text-muted">{label}</div>
      {children}
    </label>
  )
}
