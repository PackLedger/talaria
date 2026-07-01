// Server-side persistence of an assistant stream. Runs detached from the client
// response (fed by a teed branch), so an in-progress reply is saved even if the
// client disconnects/reloads. Throttled flushes during streaming; final on end.

import { parseAgentStream, mergeTool, type ToolCall } from '@/lib/sse-parse'
import { touchConversation, updateAssistant } from './conversations'

export async function persistAssistantStream(
  stream: ReadableStream<Uint8Array>,
  messageId: string,
  conversationId: string,
): Promise<void> {
  let content = ''
  let reasoning = ''
  let tools: ToolCall[] = []
  let lastFlush = 0

  const flush = (status: 'streaming' | 'complete' | 'error') =>
    updateAssistant(messageId, { content, reasoning, tools, status })

  try {
    for await (const ev of parseAgentStream(stream)) {
      if (ev.type === 'content') content += ev.text
      else if (ev.type === 'reasoning') reasoning += ev.text
      else if (ev.type === 'tool') tools = mergeTool(tools, ev)

      const now = Date.now()
      if (now - lastFlush > 400) {
        lastFlush = now
        await flush('streaming')
      }
    }
    await flush('complete')
    await touchConversation(conversationId)
  } catch {
    await flush('error').catch(() => {})
  }
}
