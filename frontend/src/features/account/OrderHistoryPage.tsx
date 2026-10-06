import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Luggage, Plane } from 'lucide-react';
import { useHistorialOrdenes } from '../../api/endpoints/orders';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { AddTripForm } from './AddTripForm';
import { formatDay, orderStatusLabel, orderStatusTone } from '../../lib/labels';
import { useSession } from '../../lib/session';

export const OrderHistoryPage: React.FC = () => {
  const session = useSession();
  // The route guard only lets customers in; the owner id keys the cache so nobody inherits another's list.
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useHistorialOrdenes(session?.ownerId);

  useEffect(() => {
    document.title = 'Mis viajes | RAM Alliance';
  }, []);

  const orders = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="bg-airline-sand px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-brand-black sm:text-3xl">Mis viajes</h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">Tus compras, de la más reciente a la más antigua.</p>
          </div>
          <Link to="/">
            <Button variant="accent" size="sm" className="gap-1.5 shadow-sm">
              <Plane className="h-3.5 w-3.5 -rotate-45" />
              <span>Nuevo vuelo</span>
            </Button>
          </Link>
        </div>

        {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-6" />}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((orden) => (
              <div key={orden.ordenId} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Orden {orden.numeroOrden}</span>
                    <span className="font-mono text-base font-extrabold text-brand-black">Código de reserva: {orden.pnr || 'pendiente'}</span>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${orderStatusTone(orden.estado)}`}>{orderStatusLabel(orden.estado)}</span>
                </div>

                <ul className="space-y-2 py-4">
                  {orden.itinerarios?.map((itin, idx) => (
                    <li key={idx} className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="flex items-center gap-2 font-bold text-slate-800">
                        <Plane className="h-4 w-4 shrink-0 -rotate-45 text-brand-gold-dark" aria-hidden="true" />
                        {itin.origen} → {itin.destino} · {itin.numeroVuelo}
                      </span>
                      <span className="text-xs text-slate-500">{formatDay(itin.salida)}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <div className="text-xs text-slate-500">{orden.pasajeros?.length || 1} pasajero(s)</div>
                  <div className="flex items-center gap-4">
                    <Link to={`/confirmacion/${orden.numeroOrden}`} state={{ orden }} className="text-xs font-bold text-brand-gold-dark hover:underline">
                      Ver billetes y comprobante
                    </Link>
                    <MoneyText amount={orden.total?.monto} currency={orden.total?.moneda} size="lg" />
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-4">
              <AddTripForm />
            </div>

            {hasNextPage && (
              <div className="pt-4 text-center">
                <Button variant="outline" onClick={() => fetchNextPage()} isLoading={isFetchingNextPage}>
                  Cargar más viajes
                </Button>
              </div>
            )}
          </div>
        ) : (
          !error && (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <Luggage className="mx-auto mb-3 h-12 w-12 text-slate-300" aria-hidden="true" />
              <h2 className="mb-1 text-lg font-bold text-slate-800">Aún no tienes viajes</h2>
              <p className="mb-6 text-xs text-slate-500">Cuando compres vuelos con tu cuenta, aparecerán aquí.</p>
              <Link to="/">
                <Button variant="primary">Buscar un vuelo</Button>
              </Link>
              <div className="mx-auto mt-8 max-w-xl border-t border-slate-100 pt-6">
                <AddTripForm />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
