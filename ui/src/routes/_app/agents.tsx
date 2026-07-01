import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/agents')({
  component: () => (
    <ViewStub
      title="Agents"
      subtitle="The roster — every agent, its status, and its stats."
      from="mission-control agents"
      targets={["Per-agent status + last seen","Task counts + success rate","Cost / tokens per agent","Register / retire"]}
    />
  ),
})
