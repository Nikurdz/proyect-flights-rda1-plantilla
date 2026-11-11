import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Search, Ticket } from 'lucide-react';
import { EXPERIENCIAS_PAGE, useExperiencias } from '../../api/endpoints/experiencias';
import type { ExperienciaView } from '../../api/types';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { ExperienceImage } from './ExperienceImage';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export const ExperienceCard: React.FC<{ experiencia: ExperienciaView }> = ({ experiencia: e }) => (
  <li className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-card-hover">
    <ExperienceImage url={e.imagenUrl} className="h-44 w-full" />
    <div className="flex flex-1 flex-col p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" size="sm">{e.tipo}</Badge>
        {e.cancelacionGratis && <Badge variant="success" size="sm">Cancelación gratuita</Badge>}
      </div>
      <h2 className="text-base font-black text-brand-black">{e.nombre}</h2>
      <p className="mt-0.5 text-[11px] text-slate-500">Ofrece {e.proveedor}</p>
      <p className="mt-2 line-clamp-3 flex-1 text-xs text-slate-600">{e.descripcion}</p>
      {e.duracion && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-600">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {e.duracion}
        </p>
      )}
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
        <div>
          <span className="block text-[11px] text-slate-500">Por persona</span>
          <MoneyText amount={e.precio.monto} currency={e.precio.moneda} size="lg" />
        </div>
        <Link to={`/experiencias/${e.id}`} aria-label={`Ver y reservar ${e.nombre}`}>
          <Button size="sm" variant="primary" tabIndex={-1}>
            Ver y reservar
          </Button>
        </Link>
      </div>
    </div>
  </li>
);

export const ExperiencesPage: React.FC = () => {
  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q.trim(), 350);
  // The page belongs to one search: a new search goes back to the first page.
  const [page, setPage] = useState({ key: debouncedQ, desde: 0 });
  const desde = page.key === debouncedQ ? page.desde : 0;

  const { data, isLoading, isFetching, error, refetch } = useExperiencias({ q: debouncedQ, desde });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  useEffect(() => {
    document.title = 'Experiencias | RAM Alliance';
  }, []);

  return (
    <div className="bg-airline-sand px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-brand-black sm:text-3xl">Experiencias</h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">Atracciones y actividades de nuestros socios para completar tu viaje. Precios en dólares (USD).</p>
          </div>
          <Link to="/mis-experiencias" className="text-xs font-bold text-brand-gold-dark hover:underline">
            Mis experiencias
          </Link>
        </div>

        <div className="mb-6 max-w-xl">
          <Input label="Buscar experiencias" type="search" placeholder="Tour, museo, parque…" value={q} onChange={(e) => setQ(e.target.value)} leftIcon={<Search className="h-4 w-4" />} />
        </div>

        {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-6" />}

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-busy="true" aria-label="Cargando">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : items.length > 0 ? (
          <>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy={isFetching}>
              {items.map((e) => (
                <ExperienceCard key={e.id} experiencia={e} />
              ))}
            </ul>
            <nav aria-label="Paginación de experiencias" className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <p>
                {total} experiencia(s) · mostrando {desde + 1}–{Math.min(desde + EXPERIENCIAS_PAGE, total)}
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={desde <= 0} onClick={() => setPage({ key: debouncedQ, desde: Math.max(0, desde - EXPERIENCIAS_PAGE) })}>
                  Anterior
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={desde + EXPERIENCIAS_PAGE >= total} onClick={() => setPage({ key: debouncedQ, desde: desde + EXPERIENCIAS_PAGE })}>
                  Siguiente
                </Button>
              </div>
            </nav>
          </>
        ) : (
          !error && (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <Ticket className="mx-auto mb-3 h-12 w-12 text-slate-300" aria-hidden="true" />
              <h2 className="mb-1 text-lg font-bold text-slate-800">{debouncedQ ? 'No encontramos experiencias con esa búsqueda' : 'Aún no hay experiencias disponibles'}</h2>
              <p className="text-xs text-slate-500">{debouncedQ ? 'Prueba con otra palabra.' : 'Vuelve pronto: nuestros socios están preparando su catálogo.'}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};
