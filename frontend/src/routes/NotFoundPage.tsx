import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plane } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Página no encontrada | RAM Alliance';
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <Plane className="mx-auto h-10 w-10 -rotate-45 text-brand-gold" aria-hidden="true" />
      <h1 className="mt-4 text-3xl font-black text-brand-black">No encontramos esta página</h1>
      <p className="mt-3 text-sm text-slate-600">Es posible que el enlace esté incompleto o que la página ya no exista.</p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/" className="rounded-lg bg-brand-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-navy">
          Buscar vuelos
        </Link>
        <Link to="/ayuda" className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Ir a Ayuda
        </Link>
      </div>
    </div>
  );
};
