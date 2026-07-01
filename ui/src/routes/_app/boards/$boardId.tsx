import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { BoardHeader } from '@/components/board/board-header'
import { Kanban } from '@/components/board/kanban'
import { TaskDetail } from '@/components/board/task-detail'
import { ShareModal } from '@/components/board/share-modal'
import { BoardAgentsModal } from '@/components/board/board-agents-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { useBoards } from '@/lib/boards'

export const Route = createFileRoute('/_app/boards/$boardId')({
  component: BoardPage,
})

function BoardPage() {
  const { boardId } = Route.useParams()
  const { data: boards = [], isLoading } = useBoards()
  const board = boards.find((b) => b.id === boardId)
  const [share, setShare] = useState(false)
  const [agentsOpen, setAgentsOpen] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  if (isLoading) return <div className="grid h-full place-items-center text-sm text-muted">Loading…</div>
  if (!board) return <EmptyState icon="⧉" title="Board not found" hint="It may have been deleted, or you don’t have access." />

  return (
    <div className="flex h-full flex-col">
      <BoardHeader board={board} onShare={() => setShare(true)} onAgents={() => setAgentsOpen(true)} />
      <div className="min-h-0 flex-1">
        <Kanban board={board} onOpen={setOpenTaskId} />
      </div>
      <ShareModal boardId={board.id} boardName={board.name} open={share} onClose={() => setShare(false)} />
      <BoardAgentsModal boardId={board.id} open={agentsOpen} onClose={() => setAgentsOpen(false)} />
      {openTaskId && <TaskDetail taskId={openTaskId} board={board} onClose={() => setOpenTaskId(null)} />}
    </div>
  )
}
