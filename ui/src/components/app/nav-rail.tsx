import { Link } from '@tanstack/react-router'
import { WingMark } from '@/components/brand'
import { NAV } from '@/lib/nav'
import type { SessionUser } from '@/lib/session'

// The main application menu (left rail). Grouped, with active-route highlighting.
export function NavRail({ user }: { user: SessionUser }) {
  const isAdmin = user.role === 'admin'
  return (
    <nav className="flex h-full w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line-subtle bg-sidebar px-2 py-4">
      {NAV.map((section) => {
        const items = section.items.filter((i) => !i.adminOnly || isAdmin)
        if (items.length === 0) return null
        return (
          <div key={section.title}>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
              {section.title}
            </div>
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    activeOptions={{ exact: item.to === '/' }}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-card hover:text-fg"
                    activeProps={{
                      className:
                        'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm bg-card text-fg [&_.nav-ico]:text-accent',
                    }}
                  >
                    <span className="nav-ico w-4 text-center text-muted">{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.adminOnly && <span className="text-[10px] text-accent">admin</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      <div className="mt-auto flex items-center gap-2 px-2 pt-2 text-[10px] text-muted">
        <WingMark className="h-4 w-4" />
        <span>Talaria · Phase 2</span>
      </div>
    </nav>
  )
}
