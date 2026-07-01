export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ToolCall {
  id?: string
  name: string
  label: string
  status: 'running' | 'completed'
}

/** A streamed event from the agent: answer text, a thinking delta, or a tool step. */
export type ChatEvent =
  | { type: 'content'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool'; id?: string; name: string; label: string; status?: 'running' | 'completed' }

function parseToolProgress(payload: string): Extract<ChatEvent, { type: 'tool' }> | null {
  try {
    const r = JSON.parse(payload) as Record<string, unknown>
    const str = (v: unknown) => (typeof v === 'string' ? v : '')
    const name = str(r.tool) || str(r.name) || 'tool'
    const label = [str(r.emoji), str(r.label)].filter(Boolean).join(' ').trim()
    const id = str(r.toolCallId) || str(r.tool_call_id) || undefined
    const s = str(r.status).toLowerCase()
    const status = s === 'running' ? 'running' : s === 'completed' || s === 'complete' ? 'completed' : undefined
    if (!label && !id) return null
    // Keep label possibly empty — a later "completed" frame carries no label and
    // must not clobber the running frame's. Display falls back to `name`.
    return { type: 'tool', id, name, label, status }
  } catch {
    return null
  }
}

/**
 * Stream a chat completion from the BFF (/api/chat → gateway plane). Yields typed
 * events: answer `content`, `reasoning` (thinking), and `tool` progress. Matches
 * the wire format Hermes agents emit (OpenAI deltas + hermes.tool.progress events).
 */
export async function* streamChat(
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ model, messages }),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`chat failed: ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by a blank line; each frame may carry an
    // `event:` name and one or more `data:` lines.
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)

      let eventName = ''
      const dataLines: string[] = []
      for (const line of frame.split('\n')) {
        const t = line.trim()
        if (t.startsWith('event:')) eventName = t.slice(6).trim()
        else if (t.startsWith('data:')) dataLines.push(t.slice(5).trim())
      }

      for (const data of dataLines) {
        if (!data || data === '[DONE]') continue

        if (eventName === 'hermes.tool.progress' || eventName === 'claude.tool.progress') {
          const tool = parseToolProgress(data)
          if (tool) yield tool
          continue
        }

        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string; reasoning?: string; reasoning_content?: string } }>
          }
          const d = json.choices?.[0]?.delta
          if (d?.content) yield { type: 'content', text: d.content }
          else if (d?.reasoning || d?.reasoning_content) {
            yield { type: 'reasoning', text: d.reasoning || d.reasoning_content || '' }
          }
        } catch {
          /* keep-alive / partial frame */
        }
      }
    }
  }
}
