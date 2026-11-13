import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';

const LINKS: { to: string; label: string }[] = [
  { to: '/transparencia', label: 'Transparencia de precios' },
  { to: '/condiciones-transporte', label: 'Condiciones de transporte' },
  { to: '/terminos', label: 'Términos de uso' },
  { to: '/privacidad', label: 'Política de privacidad' },
  { to: '/ayuda', label: 'Ayuda' },
  { to: '/ayuda#contacto', label: 'Contacto' },
];

export const Footer: React.FC = () => (
  <footer className="border-t border-line bg-surface text-sm text-muted">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo variant="full" inverted={false} />
          <p className="mt-3">Vuelos directos desde y hacia Ecuador. Todos los precios están en dólares estadounidenses (USD).</p>
        </div>
        <nav aria-label="Información legal y ayuda">
          <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            {LINKS.map((link) => (
              <li key={link.label}>
                <Link to={link.to} className="inline-block rounded py-1.5 underline-offset-2 hover:text-ink hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="flex flex-col gap-1 border-t border-line pt-4 text-xs sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} RAM Alliance</p>
        <p>Los pagos de este sitio son simulados: no se realizan cobros reales.</p>
      </div>
    </div>
  </footer>
);
