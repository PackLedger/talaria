import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/skills')({
  component: () => (
    <ViewStub
      title="Skills"
      subtitle="The skills each agent can use."
      from="hermes-native"
      targets={["Installed skills per agent","Enable / disable","Skill detail"]}
    />
  ),
})
