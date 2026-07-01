import { EmptyState } from '@/components/ui/empty-state'

// A not-yet-built view. Kept intentionally minimal — one line, no walls of text.
export function ViewStub({ title, icon }: { title: string; icon?: string }) {
  return <EmptyState icon={icon ?? '◇'} title={title} hint="Coming soon." />
}
