import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/inference')({
  component: () => <ViewStub title="Local inference" icon="▚" />,
})
