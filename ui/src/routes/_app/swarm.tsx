import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/swarm')({
  component: () => (
    <ViewStub
      title="Swarm board"
      subtitle="The fleet kanban — cards are mission-control tasks, columns are statuses."
      from="hermes-workspace swarm + mission-control"
      targets={["Columns: inbox → assigned → in_progress → quality_review → done","Drag to move (done stays human-gated)","Create card = create task","Assignee = agent"]}
    />
  ),
})
