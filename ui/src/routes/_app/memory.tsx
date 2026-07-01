import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/memory')({
  component: () => (
    <ViewStub
      title="Memory"
      subtitle="What the agents remember."
      from="hermes-native"
      targets={["Per-agent memory browse","Search","Edit / prune"]}
    />
  ),
})
