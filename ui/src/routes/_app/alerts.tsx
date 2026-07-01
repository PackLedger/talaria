import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/alerts')({
  component: () => (
    <ViewStub
      title="Alerts"
      subtitle="Warnings and incidents that need a human."
      from="mission-control alerts"
      targets={["Active alerts","Acknowledge / resolve","Routing rules"]}
    />
  ),
})
