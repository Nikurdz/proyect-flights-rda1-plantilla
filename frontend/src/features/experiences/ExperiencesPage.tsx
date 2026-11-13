import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Search, Ticket } from 'lucide-react';
import { EXPERIENCIAS_PAGE, useExperiencias } from '../../api/endpoints/experiencias';
import type { ExperienciaView } from '../../api/types';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
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
  <li className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-ink transition-colors focus-within:border-gold-text hover:border-gold-text/60">
    <ExperienceImage url={e.imagenUrl} className="h-44 w-full" />
    <div className="flex flex-1 flex-col p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" size="sm">{e.tipo}</Badge>
        {e.cancelacionGratis && <Badge variant="success" size="sm">Cancelación gratuita</Badge>}
      </div>
      <h2 className="text-lead font-semibold text-ink">{e.nombre}</h2>
      <p className="mt-0.5 text-small text-muted">Ofrece {e.proveedor}</p>
      <p className="mt-2 line-clamp-3 flex-1 text-small text-muted">{e.descripcion}</p>
      {e.duracion && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-small text-muted">
          <Clock className="h-4 w-4" aria-hidden="true" />
          {e.duracion}
        </p>
      )}
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-3">
        <div>
          <span className="block text-small text-muted">Por persona</span>
          <MoneyText amount={e.precio.monto} currency={e.precio.moneda} size="xl" className="num text-ink" />
        </div>
        <Link
          to={`/experiencias/${e.id}`}
          aria-label={`Ver y reservar ${e.nombre}`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-small font-medium text-on-ink transition-colors hover:bg-ink/90 sm:min-h-[32px] sm:py-1.5"
        >
          Ver y reservar
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
    <div className="bg-paper px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-heading font-semibold text-ink">Experiencias</h1>
            <p className="mt-1 max-w-xl text-body text-muted">Tours, museos y actividades de nuestros socios para completar tu viaje. Precios en dólares (USD).</p>
          </div>
          <Link to="/mis-experiencias" className="inline-flex min-h-[44px] items-center text-small font-medium text-gold-text underline-offset-2 hover:underline sm:min-h-0">
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
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : items.length > 0 ? (
          <>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy={isFetching}>
              {items.map((e) => (
                <ExperienceCard key={e.id} experiencia={e} />
              ))}
            </ul>
            <nav aria-label="Paginación de experiencias" className="mt-6 flex flex-wrap items-center justify-between gap-3 text-small text-muted">
              <p>
                Mostrando {desde + 1} a {Math.min(desde + EXPERIENCIAS_PAGE, total)} de {total === 1 ? '1 experiencia' : `${total} experiencias`}
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
            <EmptyState
              icon={<Ticket />}
              title={debouncedQ ? 'No encontramos experiencias con esa búsqueda' : 'Aún no hay experiencias disponibles'}
              description={debouncedQ ? 'Prueba con otra palabra.' : 'Vuelve pronto: nuestros socios están preparando su catálogo.'}
            />
          )
        )}
      </div>
    </div>
  );
};
