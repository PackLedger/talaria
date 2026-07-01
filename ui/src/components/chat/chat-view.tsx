import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Markdown } from '@/components/ui/markdown'
import { Disclosure } from '@/components/ui/disclosure'
import { streamChat, type ChatMessage, type ToolCall } from '@/lib/chat'

interface DisplayMessage {
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  tools?: ToolCall[]
}

// A streaming chat thread with one fleet agent. Remount (via a `key` on the
// model) to start a fresh thread when the agent changes.
export function ChatView({ model, agentLabel }: { model: string; agentLabel: string }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => () => abortRef.current?.abort(), [])

  // Fold a tool-progress event into the running tool list (dedupe by id/name).
  const mergeTool = (tools: ToolCall[], ev: { id?: string; name: string; label: string; status?: 'running' | 'completed' }): ToolCall[] => {
    const copy = tools.slice()
    const idx = ev.id
      ? copy.findIndex((t) => t.id === ev.id)
      : copy.findIndex((t) => t.name === ev.name && t.status === 'running')
    if (idx >= 0) {
      const existing = copy[idx]!
      copy[idx] = { ...existing, label: ev.label || existing.label, status: ev.status ?? existing.status }
    } else {
      copy.push({ id: ev.id, name: ev.name, label: ev.label, status: ev.status ?? 'running' })
    }
    return copy
  }

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setError(null)
    setInput('')

    const history: ChatMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: text },
    ]
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', reasoning: '', tools: [] },
    ])
    setStreaming(true)

    const patchLast = (fn: (m: DisplayMessage) => DisplayMessage) =>
      setMessages((prev) => {
        const copy = prev.slice()
        const last = copy[copy.length - 1]
        if (last?.role === 'assistant') copy[copy.length - 1] = fn(last)
        return copy
      })

    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      for await (const ev of streamChat(model, history, ctrl.signal)) {
        if (ev.type === 'content') patchLast((m) => ({ ...m, content: m.content + ev.text }))
        else if (ev.type === 'reasoning') patchLast((m) => ({ ...m, reasoning: (m.reasoning ?? '') + ev.text }))
        else if (ev.type === 'tool') patchLast((m) => ({ ...m, tools: mergeTool(m.tools ?? [], ev) }))
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const stop = () => abortRef.current?.abort()

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[var(--chat-content-max-width)] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <div className="mercury-text mb-1 text-lg font-semibold">Talk to {agentLabel}</div>
              <div className="text-sm text-muted">Ask anything — memory, skills, and tools intact.</div>
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === 'user' ? (
              <UserBubble key={i} content={m.content} />
            ) : (
              <AssistantTurn key={i} message={m} streaming={streaming && i === messages.length - 1} />
            ),
          )
        )}
        {error && <div className="text-center text-sm" style={{ color: 'var(--theme-danger)' }}>{error}</div>}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-6">
        <div className="mercury-panel flex items-end gap-2 rounded-2xl p-2">
          <Textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Message ${agentLabel}…`}
            className="max-h-40 min-h-[2.75rem] border-0 bg-transparent focus:border-0"
          />
          {streaming ? (
            <Button variant="outline" onClick={stop}>Stop</Button>
          ) : (
            <Button onClick={() => void send()} disabled={!input.trim()}>Send</Button>
          )}
        </div>
      </div>
    </div>
  )
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[85%] whitespace-pre-wrap rounded-2xl border px-4 py-2.5 text-sm text-[color:var(--chat-user-foreground)]"
        style={{ background: 'var(--chat-user-bg)', borderColor: 'var(--chat-user-border)' }}
      >
        {content}
      </div>
    </div>
  )
}

function AssistantTurn({ message, streaming }: { message: DisplayMessage; streaming: boolean }) {
  const { content, reasoning, tools } = message
  const hasReasoning = !!reasoning?.trim()
  const hasTools = !!tools?.length
  const empty = !content && !hasReasoning && !hasTools

  return (
    <div className="flex justify-start">
      <div
        className="max-w-[85%] space-y-2 rounded-2xl border px-4 py-2.5 text-sm text-[color:var(--chat-assistant-foreground)]"
        style={{ background: 'var(--chat-assistant-bg)', borderColor: 'var(--chat-assistant-border)' }}
      >
        {hasReasoning && (
          <Disclosure title="Thinking" icon={<span>✦</span>}>
            <div className="whitespace-pre-wrap text-xs text-muted">{reasoning}</div>
          </Disclosure>
        )}

        {hasTools && (
          <Disclosure title={`${tools!.length} tool ${tools!.length === 1 ? 'call' : 'calls'}`} icon={<span>⚙</span>}>
            <ul className="space-y-1.5">
              {tools!.map((t, i) => (
                <li key={t.id ?? `${t.name}-${i}`} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 shrink-0">
                    <ToolStatus status={t.status} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-fg">{t.name}</span>
                    {t.label && (
                      <span className="mt-0.5 block whitespace-pre-wrap break-words font-[var(--font-mono)] text-muted">
                        {t.label}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Disclosure>
        )}

        {content && <Markdown>{content}</Markdown>}

        {empty && streaming && (
          <span className="inline-flex gap-1 py-1">
            <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
          </span>
        )}
        {content && streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-middle" />}
      </div>
    </div>
  )
}

function ToolStatus({ status }: { status: 'running' | 'completed' }) {
  return status === 'completed' ? (
    <span className="text-[color:var(--theme-success)]">✓</span>
  ) : (
    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
  )
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted"
      style={{ animationDelay: `${delay}s` }}
    />
  )
}
