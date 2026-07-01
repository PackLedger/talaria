import { createFileRoute } from '@tanstack/react-router'
import { ViewStub } from '@/components/app/view-stub'

export const Route = createFileRoute('/_app/inference')({
  component: () => (
    <ViewStub
      title="Local inference"
      subtitle="Monitor the self-hosted inference stacks under the fleet."
      from="Talaria (new · P2.5)"
      targets={["Ollama / vLLM / llama.cpp / TGI health","Loaded models","GPU / VRAM utilization","Tokens per second"]}
    />
  ),
})
