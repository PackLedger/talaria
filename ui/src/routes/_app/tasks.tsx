import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/tasks')({
  component: () => (
    <ViewStub
      title="Tasks"
      subtitle="The full mission-control task queue and task detail."
      from="mission-control tasks"
      targets={["Task board + list","Task detail: description, comments, history","Assign / reassign","Aegis-gated done"]}
    />
  ),
})
