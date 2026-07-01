import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/mcp')({
  component: () => <ViewStub title="MCP" icon="⧈" />,
})
