/** Structure of the back office: four groups, each page under /admin/... (the routes do not change). */
export type AdminPageKey =
  | 'dashboard'
  | 'ordenes'
  | 'reservas'
  | 'vuelos'
  | 'aeropuertos'
  | 'facturacion'
  | 'facturacion-booking'
  | 'usuarios'
  | 'webhooks'
  | 'auditoria'
  | 'observabilidad';

export interface AdminNavItem {
  key: AdminPageKey;
  label: string;
  to: string;
}

export interface AdminNavGroup {
  id: string;
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: 'ventas',
    label: 'Ventas',
    items: [
      { key: 'dashboard', label: 'Resumen', to: '/admin/dashboard' },
      { key: 'ordenes', label: 'Órdenes', to: '/admin/ordenes' },
      { key: 'reservas', label: 'Reservas de mostrador', to: '/admin/reservas' },
    ],
  },
  {
    id: 'operacion',
    label: 'Operación',
    items: [
      { key: 'vuelos', label: 'Vuelos', to: '/admin/vuelos' },
      { key: 'aeropuertos', label: 'Aeropuertos', to: '/admin/aeropuertos' },
    ],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    items: [
      { key: 'facturacion', label: 'Facturas', to: '/admin/facturacion' },
      { key: 'facturacion-booking', label: 'Conciliación Booking', to: '/admin/facturacion-booking' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    items: [
      { key: 'usuarios', label: 'Usuarios', to: '/admin/usuarios' },
      { key: 'webhooks', label: 'Webhooks', to: '/admin/webhooks' },
      { key: 'auditoria', label: 'Trazabilidad', to: '/admin/auditoria' },
      { key: 'observabilidad', label: 'Observabilidad', to: '/admin/observabilidad' },
    ],
  },
];

export const adminPage = (key: AdminPageKey): { group: AdminNavGroup; item: AdminNavItem } => {
  for (const group of ADMIN_NAV) {
    const item = group.items.find((i) => i.key === key);
    if (item) return { group, item };
  }
  throw new Error(`Página de administración desconocida: ${key}`);
};

/** The item whose path contains the location (used for the current page name on phones). */
export const currentAdminItem = (pathname: string): AdminNavItem | undefined =>
  ADMIN_NAV.flatMap((g) => g.items).find((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));
