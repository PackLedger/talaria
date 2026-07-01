import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/cost')({
  component: () => (
    <ViewStub
      title="Cost & tokens"
      subtitle="Spend and token governance across the fleet."
      from="mission-control tokens/by-agent"
      targets={["Tokens per agent / per day","Cost breakdown","Budgets + alerts","Trends"]}
    />
  ),
})
