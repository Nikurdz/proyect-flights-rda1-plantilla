import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, Luggage, Plane } from 'lucide-react';
import { useHistorialOrdenes } from '../../api/endpoints/orders';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { AddTripForm } from './AddTripForm';
import { formatDay, orderStatusLabel } from '../../lib/labels';
import { orderStatusInfo, type OrderStatusIcon } from '../../lib/order-status';
import { useSession } from '../../lib/session';

const ICONS: Record<OrderStatusIcon, React.ReactNode> = {
  ok: <CheckCircle2 />,
  plane: <Plane />,
  clock: <Clock />,
  alert: <AlertCircle />,
};

export const OrderHistoryPage: React.FC = () => {
  const session = useSession();
  // The route guard only lets customers in; the owner id keys the cache so nobody inherits another's list.
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useHistorialOrdenes(session?.ownerId);

  useEffect(() => {
    document.title = 'Mis viajes | RAM Alliance';
  }, []);

  const orders = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="bg-paper px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Mis viajes"
          description="Tus compras, de la más reciente a la más antigua."
          actions={
            <ButtonLink to="/" variant="accent" size="md" className="gap-2">
              <Plane className="h-4 w-4 -rotate-45" aria-hidden="true" />
              Buscar vuelos
            </ButtonLink>
          }
        />

        {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-6" />}

        {isLoading ? (
          <div className="space-y-4" role="status" aria-busy="true" aria-label="Cargando tus viajes">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((orden) => {
              const info = orderStatusInfo(orden.estado);
              const ready = orden.estado === 'EMITIDA' || orden.estado === 'MODIFICADA';
              const passengers = orden.pasajeros?.length || 1;
              return (
                <article key={orden.ordenId} aria-label={`Orden ${orden.numeroOrden}`} className="rounded-xl border border-line bg-surface p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                    <div>
                      <p className="text-small text-muted">Código de reserva</p>
                      <p className="num text-lead font-semibold text-ink">{orden.pnr || 'Pendiente'}</p>
                      <p className="num text-small text-muted">Orden {orden.numeroOrden}</p>
                    </div>
                    <Badge variant={info.tone} icon={ICONS[info.icon]}>
                      {orderStatusLabel(orden.estado)}
                    </Badge>
                  </div>

                  <ul className="space-y-2 py-4">
                    {orden.itinerarios?.map((itin, idx) => (
                      <li key={idx} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <span className="flex items-center gap-2 text-body font-medium text-ink">
                          <Plane className="h-4 w-4 shrink-0 -rotate-45 text-gold-text" aria-hidden="true" />
                          {itin.origen} a {itin.destino}
                          <span className="num text-small font-normal text-muted">Vuelo {itin.numeroVuelo}</span>
                        </span>
                        <span className="text-small text-muted">{formatDay(itin.salida)}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="pb-4 text-small text-muted">{info.next}</p>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                    <div>
                      <p className="text-small text-muted">
                        {passengers} {passengers === 1 ? 'pasajero' : 'pasajeros'}
                      </p>
                      <div className="num text-ink">
                        <MoneyText amount={orden.total?.monto} currency={orden.total?.moneda} size="lg" />
                      </div>
                    </div>
                    <ButtonLink to={`/confirmacion/${orden.numeroOrden}`} state={{ orden }} variant={ready ? 'primary' : 'outline'} size="md">
                      {ready ? 'Ver billetes y comprobante' : 'Ver detalle'}
                    </ButtonLink>
                  </div>
                </article>
              );
            })}

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
            <div className="rounded-xl border border-line bg-surface">
              <EmptyState
                icon={<Luggage />}
                title="Aún no tienes viajes"
                description="Cuando compres vuelos con tu cuenta, aparecerán aquí."
                action={
                  <ButtonLink to="/" variant="accent" size="md">
                    Buscar vuelos
                  </ButtonLink>
                }
              />
              <div className="mx-auto max-w-xl border-t border-line px-4 py-6">
                <AddTripForm />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
