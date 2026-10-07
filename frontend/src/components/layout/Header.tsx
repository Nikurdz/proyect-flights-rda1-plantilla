import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, ShieldCheck, User, X } from 'lucide-react';
import { useSession } from '../../lib/session';
import { endSession } from '../../lib/auth-actions';
import { Logo } from '../ui/Logo';

const NAV_ITEMS = [
  { to: '/', label: 'Reservar', end: true },
  { to: '/recuperar-orden', label: 'Gestionar viaje', end: false },
  { to: '/transparencia', label: 'Información', end: false },
  { to: '/ayuda', label: 'Ayuda', end: false },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
    isActive ? 'text-brand-gold' : 'text-slate-200 hover:text-white'
  }`;

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const [open, setOpen] = useState(false);

  // The mobile panel closes when the visitor goes somewhere.
  useEffect(() => setOpen(false), [location.pathname]);

  const isCustomer = session?.kind === 'customer';

  const handleLogout = () => {
    endSession();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-brand-gold/30 bg-brand-black text-white shadow-md">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-brand-black"
      >
        Saltar al contenido
      </a>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-2 sm:gap-4 lg:h-20">
          <Link to="/" aria-label="RAM Alliance, inicio" className="min-w-0 focus-visible:ring-offset-brand-black">
            <Logo variant="full" inverted />
          </Link>

          <nav aria-label="Principal" className="hidden items-center lg:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {session?.isAdmin && (
              <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white">
                <ShieldCheck className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                Administración
              </Link>
            )}
            {isCustomer ? (
              <>
                <Link to="/mis-ordenes" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white">
                  <User className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                  Mis viajes
                </Link>
                <Link to="/mi-cuenta" className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white">
                  Mi cuenta
                </Link>
                <button type="button" onClick={handleLogout} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white">
                  Iniciar sesión
                </Link>
                <Link to="/registro" className="rounded-lg bg-brand-gold px-4 py-2 text-xs font-bold text-brand-black transition-colors hover:bg-brand-gold-light">
                  Crear cuenta
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10 lg:hidden"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            aria-controls="menu-movil"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="menu-movil" className="border-t border-white/10 bg-brand-black lg:hidden">
          <nav aria-label="Principal móvil" className="mx-auto flex max-w-7xl flex-col px-4 py-3 sm:px-6">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `${linkClass({ isActive })} py-3`}>
                {item.label}
              </NavLink>
            ))}
            <div className="my-2 border-t border-white/10" />
            {session?.isAdmin && (
              <Link to="/admin" className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">
                Administración
              </Link>
            )}
            {isCustomer ? (
              <>
                <Link to="/mis-ordenes" className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">
                  Mis viajes
                </Link>
                <Link to="/mi-cuenta" className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">
                  Mi cuenta
                </Link>
                <button type="button" onClick={handleLogout} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Salir
                </button>
              </>
            ) : (
              <div className="flex gap-3 py-3">
                <Link to="/login" className="flex-1 rounded-lg border border-white/20 px-4 py-2.5 text-center text-xs font-semibold text-white">
                  Iniciar sesión
                </Link>
                <Link to="/registro" className="flex-1 rounded-lg bg-brand-gold px-4 py-2.5 text-center text-xs font-bold text-brand-black">
                  Crear cuenta
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};
