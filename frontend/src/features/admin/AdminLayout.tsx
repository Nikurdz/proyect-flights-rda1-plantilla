import React, { useEffect, useId, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { ADMIN_NAV, currentAdminItem } from './admin-nav';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-ink font-semibold text-on-ink' : 'text-ink hover:bg-ink/5'}`;

/** Back-office frame (ADMIN only; the route guard and the API both enforce it): side navigation in four groups. */
export const AdminLayout: React.FC = () => {
  const { pathname } = useLocation();
  // The phone menu is open for one path only: a new page closes it.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const navId = useId();
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
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          <nav id={navId} aria-label="Administración" className={`${open ? 'mt-2 block' : 'hidden'} rounded-xl border border-line bg-surface p-3 lg:block`}>
            {ADMIN_NAV.map((group) => (
              <div key={group.id} className="mb-3 last:mb-0">
                <p id={`${navId}-${group.id}`} className="px-3 pb-1 text-small font-semibold text-muted">
                  {group.label}
                </p>
                <ul aria-labelledby={`${navId}-${group.id}`} className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.key}>
                      <NavLink to={item.to} className={linkClass}>
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
