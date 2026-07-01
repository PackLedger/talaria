import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/admin')({
  component: () => (
    <ViewStub
      title="Admin"
      subtitle="Manage users, roles, and per-agent access."
      from="Talaria (multi-tenant)"
      targets={["Users + roles (admin / member)","Per-agent allow-lists","Invite / disable users","Audit log"]}
    />
  ),
})
