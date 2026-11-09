import React from 'react';
import { NavLink } from 'react-router-dom';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${isActive ? 'bg-brand-black text-white' : 'text-slate-600 hover:bg-slate-100'}`;

/** The two views of Facturación: our own invoices and the reconciliation of what Booking bills. */
export const BillingTabs: React.FC = () => (
  <nav aria-label="Facturación" className="mb-4 inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
    <NavLink to="/admin/facturacion" end className={tabClass}>
      Facturas
    </NavLink>
    <NavLink to="/admin/facturacion-booking" className={tabClass}>
      Booking
    </NavLink>
  </nav>
);
