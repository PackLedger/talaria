import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/activity')({
  component: () => (
    <ViewStub
      title="Activity"
      subtitle="A live feed of what the fleet is doing."
      from="mission-control activity / standup"
      targets={["Activity feed","Daily standup summary","Filter by agent / type"]}
    />
  ),
})
