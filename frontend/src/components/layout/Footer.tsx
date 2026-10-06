import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';

interface Column {
  title: string;
  links: { to: string; label: string }[];
}

const COLUMNS: Column[] = [
  {
    title: 'Reservar',
    links: [
      { to: '/', label: 'Buscar vuelos' },
      { to: '/recuperar-orden', label: 'Gestionar mi viaje' },
      { to: '/registro', label: 'Crear una cuenta' },
      { to: '/login', label: 'Iniciar sesión' },
    ],
  },
  {
    title: 'Transparencia y condiciones',
    links: [
      { to: '/transparencia', label: 'Transparencia de precios' },
      { to: '/condiciones-transporte', label: 'Condiciones de transporte' },
      { to: '/terminos', label: 'Términos de uso' },
      { to: '/privacidad', label: 'Política de privacidad' },
    ],
  },
  {
    title: 'Soporte',
    links: [
      { to: '/ayuda', label: 'Preguntas frecuentes' },
      { to: '/ayuda#contacto', label: 'Contacto' },
      { to: '/transparencia#familias', label: 'Familias tarifarias' },
    ],
  },
];

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-brand-gold/30 bg-brand-black text-sm text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <Logo variant="full" inverted />
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-slate-400">
              Compra de vuelos directos entre Ecuador, Colombia, Perú, Chile, Argentina, Brasil, Panamá, Estados Unidos y España. Todos los precios se expresan en dólares estadounidenses (USD).
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white">{column.title}</h2>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-xs transition-colors hover:text-brand-gold">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-[11px] text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} RAM Alliance. Proyecto académico de integración de sistemas.</p>
          <p>Los pagos de este sitio son simulados: no se realizan cobros reales.</p>
        </div>
      </div>
    </footer>
  );
};
