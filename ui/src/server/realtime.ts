// Real-time fan-out over Redis pub/sub → SSE. Board mutations publish a small
// event to `board:<id>`; each connected client holds an SSE stream fed by a
// dedicated Redis subscriber. Lets boards be multiplayer without websockets.
import Redis from 'ioredis'
import { getRedis } from './db/redis'

export interface BoardEvent {
  type: 'task' | 'comment' | 'board'
  taskId?: string
  deleted?: boolean
}

export function publishBoard(boardId: string, event: BoardEvent): void {
  void getRedis().publish(`board:${boardId}`, JSON.stringify(event))
}

/** An SSE ReadableStream of a board's events (own Redis subscriber per client). */
export function boardEventStream(boardId: string, signal: AbortSignal): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  const sub = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 3 })
  const channel = `board:${boardId}`

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (s: string) => {
        try {
          controller.enqueue(enc.encode(s))
        } catch {
          /* stream closed */
        }
      }
      send(': connected\n\n')
      void sub.subscribe(channel)
      sub.on('message', (_ch, msg) => send(`data: ${msg}\n\n`))
      const ping = setInterval(() => send(': ping\n\n'), 25_000)

      const cleanup = () => {
        clearInterval(ping)
        sub.disconnect()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
      if (signal.aborted) cleanup()
      else signal.addEventListener('abort', cleanup, { once: true })
    },
    cancel() {
      sub.disconnect()
    },
  })
}
