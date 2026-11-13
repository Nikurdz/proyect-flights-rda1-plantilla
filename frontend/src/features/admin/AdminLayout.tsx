import React, { useEffect, useId, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { ADMIN_NAV, currentAdminItem } from './admin-nav';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-ink font-semibold text-on-ink' : 'text-ink hover:bg-ink/5'}`;

/** The group that holds the page at `pathname` (always shown open). */
const activeGroupId = (pathname: string): string | undefined => {
  const item = currentAdminItem(pathname);
  return ADMIN_NAV.find((g) => g.items.some((i) => i.key === item?.key))?.id;
};

/** Back-office frame (ADMIN only; the route guard and the API both enforce it): side navigation as an accordion of four groups. */
export const AdminLayout: React.FC = () => {
  const { pathname } = useLocation();
  // The phone menu is open for one path only: a new page closes it.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const navId = useId();
  const activeId = activeGroupId(pathname);
  // Only the group of the current page starts open; navigating opens the new page's group and keeps the user's other choices.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => (activeId ? { [activeId]: true } : {}));
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (activeId && !openGroups[activeId]) setOpenGroups({ ...openGroups, [activeId]: true });
  }
  useEffect(() => {
    document.title = 'Administración | RAM Alliance';
  }, []);

  const current = currentAdminItem(pathname);

  return (
    <div className="bg-paper px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={navId}
            onClick={() => setOpenPath(open ? null : pathname)}
            className="flex min-h-[44px] w-full items-center justify-between rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-left text-sm font-medium text-ink lg:hidden"
          >
            <span>
              Menú de administración
              {current && <span className="text-muted"> · {current.label}</span>}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          <nav id={navId} aria-label="Administración" className={`${open ? 'mt-2 block' : 'hidden'} rounded-xl border border-line bg-surface p-3 lg:block`}>
            {ADMIN_NAV.map((group) => {
              const expanded = Boolean(openGroups[group.id]);
              const isActiveGroup = group.id === activeId;
              const panelId = `${navId}-${group.id}`;
              return (
                <div key={group.id} className="mb-1.5 last:mb-0">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpenGroups({ ...openGroups, [group.id]: !expanded })}
                    className={`flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold text-ink transition-colors hover:border-line-strong hover:bg-ink/5 ${isActiveGroup ? 'border-line-strong bg-ink/5' : 'border-line bg-surface'}`}
                  >
                    <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${isActiveGroup ? 'bg-gold-text' : 'border border-line-strong'}`} />
                    <span className="flex-1">{group.label}</span>
                    {isActiveGroup && <span className="sr-only">(sección actual)</span>}
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  <ul id={panelId} hidden={!expanded} aria-label={group.label} className="ml-4 mt-1 space-y-0.5 border-l border-line pl-3">
                    {group.items.map((item) => (
                      <li key={item.key}>
                        <NavLink to={item.to} className={linkClass}>
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
        </div>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
