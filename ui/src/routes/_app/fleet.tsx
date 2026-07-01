import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/fleet')({
  component: () => (
    <ViewStub
      title="Fleet overview"
      subtitle="Fleet health at a glance: who is online, idle, or busy."
      from="mission-control dashboard"
      targets={["Agents online / idle / busy","Health + crash recovery","Heartbeat freshness","Fleet-wide throughput"]}
    />
  ),
})
