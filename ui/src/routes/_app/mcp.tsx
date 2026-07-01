import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/mcp')({
  component: () => (
    <ViewStub
      title="MCP"
      subtitle="Model Context Protocol servers wired into the fleet."
      from="hermes-native"
      targets={["Connected MCP servers","Tools exposed","Health + logs"]}
    />
  ),
})
