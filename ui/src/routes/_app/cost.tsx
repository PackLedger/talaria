import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/cost')({
  component: () => <ViewStub title="Cost & tokens" icon="⌗" />,
})
