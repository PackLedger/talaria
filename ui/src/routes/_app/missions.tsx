import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/missions')({
  component: () => (
    <ViewStub
      title="Missions"
      subtitle="Decompose a goal into a mission and watch the conductor run it."
      from="hermes-workspace Conductor"
      targets={["Create a mission (name + prompt)","Live status: running / completed / failed","Cancel and retry","Per-step timeline"]}
    />
  ),
})
