import { Panel } from '@/components/ui/panel'

// Placeholder for a not-yet-built view. Lists what it'll contain (parity target)
// and where it's lifted from, so the app shell is navigable end-to-end now.
export function ViewStub({
  title,
  subtitle,
  from,
  targets,
}: {
  title: string
  subtitle: string
  from?: string
  targets?: string[]
}) {
  return (
    <div className="grid h-full place-items-center overflow-y-auto p-6">
      <Panel className="w-full max-w-lg p-8">
        <div className="mb-1 flex items-center gap-3">
          <h1 className="mercury-text text-2xl font-semibold">{title}</h1>
          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">stub</span>
        </div>
        <p className="mb-4 text-sm text-muted">{subtitle}</p>

        {targets && targets.length > 0 && (
          <div className="mb-4">
            <div className="mb-1 text-xs uppercase tracking-wide text-muted">Parity targets</div>
            <ul className="space-y-1 text-sm text-fg">
              {targets.map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-accent">▹</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {from && <div className="text-xs text-muted">Lifting from: {from}</div>}
      </Panel>
    </div>
  )
}
