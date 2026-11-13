import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { useSession } from '../../lib/session';
import { endSession } from '../../lib/auth-actions';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-ink/[0.07] text-ink' : 'text-muted hover:bg-ink/5 hover:text-ink'}`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-[44px] items-center rounded-lg px-3 text-body font-medium ${isActive ? 'bg-ink/[0.07] text-ink' : 'text-ink hover:bg-ink/5'}`;

/** Main navigation, in the traveller's words. «Mis viajes» is the account's orders; without a session it is the public recovery page. */
function navItemsFor(isCustomer: boolean): NavItem[] {
  return [
    { to: '/', label: 'Buscar vuelos', end: true },
    isCustomer ? { to: '/mis-ordenes', label: 'Mis viajes' } : { to: '/recuperar-orden', label: 'Gestionar mi viaje' },
    { to: '/experiencias', label: 'Experiencias' },
    ...(isCustomer ? [{ to: '/mis-experiencias', label: 'Mis experiencias' }] : []),
    { to: '/ayuda', label: 'Ayuda' },
  ];
}

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  // The mobile panel remembers the page it was opened on, so it closes by itself when the visitor
  // goes somewhere else (no effect needed).
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === location.pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);

  const isCustomer = session?.kind === 'customer';
  const navItems = navItemsFor(isCustomer);

  // Escape closes the mobile panel and gives the focus back to its button.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenOn(null);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handleLogout = () => {
    endSession();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 text-ink backdrop-blur">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-on-ink"
      >
        Saltar al contenido
      </a>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-6">
            <Link to="/" aria-label="RAM Alliance, inicio" className="min-w-0 rounded-lg">
              <Logo variant="full" inverted={false} />
            </Link>
            <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggle />
            {session?.isAdmin && (
              <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-ink/5 hover:text-ink">
                <ShieldCheck className="h-4 w-4 text-gold-text" aria-hidden="true" />
                Administración
              </Link>
            )}
            {isCustomer ? (
              <>
                <Link to="/mi-cuenta" className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-ink/5 hover:text-ink">
                  Mi cuenta
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-ink/5 hover:text-ink"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-ink/5 hover:text-ink">
                  Iniciar sesión
                </Link>
                <Link to="/registro" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-on-ink transition-colors hover:bg-ink/90">
                  Crear cuenta
                </Link>
              </>
            )}
          </div>

          <button
            ref={toggleRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-ink/5 lg:hidden"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            aria-controls="menu-movil"
            onClick={() => setOpenOn(open ? null : location.pathname)}
          >
            {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="menu-movil" className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-line bg-surface lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            <nav aria-label="Principal móvil" className="flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={mobileLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="my-2 border-t border-line" />
            <div className="flex flex-col gap-1">
              {session?.isAdmin && (
                <Link to="/admin" className={mobileLinkClass({ isActive: false })}>
                  Administración
                </Link>
              )}
              {isCustomer ? (
                <>
                  <Link to="/mi-cuenta" className={mobileLinkClass({ isActive: false })}>
                    Mi cuenta
                  </Link>
                  <button type="button" onClick={handleLogout} className={`${mobileLinkClass({ isActive: false })} w-full text-left`}>
                    Salir
                  </button>
                </>
              ) : (
                <div className="flex gap-3 py-1">
                  <Link to="/login" className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-line-strong px-4 text-sm font-medium text-ink">
                    Iniciar sesión
                  </Link>
                  <Link to="/registro" className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-ink px-4 text-sm font-medium text-on-ink">
                    Crear cuenta
                  </Link>
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-3">
              <span className="text-sm text-muted">Tema</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
