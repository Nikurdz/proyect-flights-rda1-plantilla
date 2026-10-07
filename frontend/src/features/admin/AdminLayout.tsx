import React, { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-brand-black text-white' : 'text-slate-600 hover:bg-slate-100'}`;

/** Back-office frame (ADMIN only; the route guard and the API both enforce it). */
export const AdminLayout: React.FC = () => {
  useEffect(() => {
    document.title = 'Administración | RAM Alliance';
  }, []);

  return (
    <div className="bg-airline-sand px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-brand-black p-2.5 text-brand-gold">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-brand-black">Administración</h1>
              <p className="text-xs text-slate-500">Dashboard, órdenes, vuelos, usuarios y estado del sistema.</p>
            </div>
          </div>
          <nav aria-label="Administración" className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
            <NavLink to="/admin/dashboard" className={tabClass}>
              Dashboard
            </NavLink>
            <NavLink to="/admin/ordenes" className={tabClass}>
              Órdenes
            </NavLink>
            <NavLink to="/admin/vuelos" className={tabClass}>
              Vuelos
            </NavLink>
            <NavLink to="/admin/usuarios" className={tabClass}>
              Usuarios
            </NavLink>
            <NavLink to="/admin/observabilidad" className={tabClass}>
              Observabilidad
            </NavLink>
          </nav>
        </div>
        <Outlet />
      </div>
    </div>
  );
};
