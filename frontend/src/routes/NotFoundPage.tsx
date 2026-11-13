import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plane } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Página no encontrada | RAM Alliance';
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <Plane className="mx-auto h-10 w-10 -rotate-45 text-gold-text" aria-hidden="true" />
      <h1 className="mt-4 text-heading font-semibold text-ink">No encontramos esta página</h1>
      <p className="mt-3 text-small text-muted">Es posible que el enlace esté incompleto o que la página ya no exista.</p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/" className="rounded-lg bg-ink px-5 py-2.5 text-small font-semibold text-on-ink hover:bg-ink/90">
          Buscar vuelos
        </Link>
        <Link to="/ayuda" className="rounded-lg border border-line-strong bg-surface px-5 py-2.5 text-small font-semibold text-ink hover:bg-paper">
          Ir a Ayuda
        </Link>
      </div>
    </div>
  );
};
