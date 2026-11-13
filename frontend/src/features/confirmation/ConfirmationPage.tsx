import React, { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, Copy, Info, Mail, Printer, Ticket, UserPlus } from 'lucide-react';
import { useOrdenPropia } from '../../api/endpoints/orders';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { TicketQr } from '../../components/common/TicketQr';
import { Badge } from '../../components/ui/Badge';
import { BoardingPass } from '../../components/ui/BoardingPass';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { timeZoneOf } from '../../lib/airports';
import { formatDateInTimeZone, formatDuration, formatTimeInTimeZone } from '../../lib/dates';
import { fareFamilyLabel, formatDateTime, orderStatusLabel, passengerTypeLabel } from '../../lib/labels';
import { useSession } from '../../lib/session';
import { loadLastOrder, saveLastOrder } from '../../lib/storage';
import { useToast } from '../../lib/toast';
import type { OrdenViewDto } from '../../api/types';

const statusVariant = (estado: string): 'success' | 'danger' | 'warning' => (estado === 'EMITIDA' ? 'success' : estado === 'FALLIDA_COMPENSADA' ? 'danger' : 'warning');

export const ConfirmationPage: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const location = useLocation();
  const session = useSession();
  const toast = useToast();

  // Where the order comes from: the page that sent us here, the copy kept for this tab (so a
  // refresh or a print still works for a guest), or, with a session, the API.
  const stateOrden = (location.state as { orden?: OrdenViewDto } | null)?.orden;
  const cachedOrden = orderNumber ? loadLastOrder<OrdenViewDto>(orderNumber) : null;
  const known = stateOrden ?? cachedOrden ?? undefined;

  const { data: fetchedOrden, isLoading, error } = useOrdenPropia(known ? undefined : orderNumber, Boolean(session));
  const orden = known ?? fetchedOrden;

  useEffect(() => {
    if (orden) saveLastOrder(orden);
    document.title = 'Tu reserva | RAM Alliance';
  }, [orden]);

  const handleCopyPnr = async () => {
    if (!orden?.pnr) return;
    try {
      await navigator.clipboard.writeText(orden.pnr);
      toast.success('Código copiado');
    } catch {
      toast.error('No pudimos copiar el código', 'Selecciónalo y cópialo a mano.');
    }
  };

  const confirmed = orden?.estado === 'EMITIDA';
  const isGuest = session?.kind !== 'customer';

  // Offer to keep the trip in an account, with what we already know filled in.
  const firstPassenger = orden?.pasajeros?.[0];
  const registerParams = new URLSearchParams({ next: '/mis-ordenes' });
  if (orden?.contacto?.correo) registerParams.set('correo', orden.contacto.correo);
  if (firstPassenger) {
    registerParams.set('nombres', firstPassenger.nombres);
    registerParams.set('apellidos', firstPassenger.apellidos);
  }

  return (
    <div className="bg-paper px-4 py-10 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl space-y-8">
        {orden && (
          <header className="space-y-3 text-center print:text-left">
            <span
              className={`inline-flex h-14 w-14 items-center justify-center rounded-full print:hidden ${confirmed ? 'bg-success-soft text-success' : 'bg-gold-soft text-gold-text'}`}
              aria-hidden="true"
            >
              {confirmed ? <CheckCircle2 className="h-8 w-8" /> : <Info className="h-8 w-8" />}
            </span>
            <h1 className="text-heading font-semibold text-ink">{confirmed ? 'Tu reserva está confirmada' : 'Detalle de tu reserva'}</h1>
            <p className="mx-auto max-w-xl text-body text-muted print:mx-0">
              Guarda tu código de reserva. Con él y tu apellido puedes recuperar este comprobante cuando quieras.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 print:hidden">
              {orden.pnr && (
                <Button type="button" variant="outline" onClick={handleCopyPnr}>
                  <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                  Copiar código de reserva
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                Imprimir comprobante
              </Button>
            </div>
          </header>
        )}

        {error != null && !orden && (
          <div className="space-y-3">
            <ProblemAlert error={error} />
            <p className="text-center text-small text-muted">
              Si compraste sin cuenta, recupera tu viaje con tu código de reserva en{' '}
              <Link to="/recuperar-orden" className="font-medium text-gold-text underline">
                Gestionar viaje
              </Link>
              .
            </p>
          </div>
        )}

        {!orden && !error && !session && (
          <EmptyState
            title="No pudimos mostrar esta reserva"
            description="Para verla, ingresa tu código de reserva y tu apellido."
            headingLevel={2}
            action={
              <Link to="/recuperar-orden" className="inline-flex min-h-[44px] items-center rounded-lg bg-ink px-5 py-2.5 text-small font-medium text-on-ink hover:bg-ink/90">
                Gestionar viaje
              </Link>
            }
          />
        )}

        {isLoading && !orden ? (
          <div className="space-y-4" role="status" aria-busy="true" aria-label="Cargando">
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        ) : orden ? (
          <>
            <section className="space-y-4" aria-labelledby="itinerario">
              <h2 id="itinerario" className="text-lead font-semibold text-ink">
                Tu itinerario
              </h2>
              {orden.itinerarios.map((itin, idx, all) => {
                const originZone = timeZoneOf(itin.origen);
                const destinationZone = timeZoneOf(itin.destino);
                const minutes = Math.round((new Date(itin.llegada).getTime() - new Date(itin.salida).getTime()) / 60000);
                return (
                  <BoardingPass
                    key={idx}
                    className="print-card"
                    ariaLabel={`${all.length > 1 ? (idx === 0 ? 'Ida' : 'Vuelta') + ': ' : ''}vuelo ${itin.numeroVuelo} de ${itin.origen} a ${itin.destino}`}
                    origin={{ code: itin.origen, time: formatTimeInTimeZone(itin.salida, originZone), date: formatDateInTimeZone(itin.salida, originZone) }}
                    destination={{ code: itin.destino, time: formatTimeInTimeZone(itin.llegada, destinationZone), date: formatDateInTimeZone(itin.llegada, destinationZone) }}
                    duration={formatDuration(minutes)}
                    details={
                      <span>
                        {all.length > 1 && <span className="font-medium text-ink">{idx === 0 ? 'Ida' : 'Vuelta'}. </span>}
                        Vuelo <span className="num">{itin.numeroVuelo}</span>, directo, tarifa {fareFamilyLabel(itin.familia)}. Horas de Ecuador.
                      </span>
                    }
                    stub={
                      <>
                        <p className="text-small text-muted">Código de reserva</p>
                        <p className="num break-all text-display font-semibold tracking-wider text-ink">{orden.pnr || '—'}</p>
                        <div>
                          <Badge variant={statusVariant(orden.estado)}>{orderStatusLabel(orden.estado)}</Badge>
                        </div>
                      </>
                    }
                  />
                );
              })}
            </section>

            <Card className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-small text-muted">Número de orden</p>
                <p className="num font-semibold text-ink">{orden.numeroOrden}</p>
                <p className="text-small text-muted">Compra del {formatDateTime(orden.creadaEn)}</p>
              </div>
              <div>
                <p className="text-small text-muted">Total pagado</p>
                <MoneyText amount={orden.total.monto} currency={orden.total.moneda} size="xl" className="num text-ink" />
              </div>
              {orden.contacto?.correo && (
                <div className="min-w-0">
                  <p className="text-small text-muted">Boletos enviados a</p>
                  <p className="truncate font-medium text-ink">{orden.contacto.correo}</p>
                </div>
              )}
            </Card>

            <section className="space-y-4" aria-labelledby="pasajeros">
              <h2 id="pasajeros" className="flex items-center gap-2 text-lead font-semibold text-ink">
                <Ticket className="h-5 w-5 text-gold-text" aria-hidden="true" />
                Pasajeros y boletos
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {orden.pasajeros.map((pax) => (
                  <Card key={pax.id} className="space-y-2 print-card">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">
                        {pax.nombres} {pax.apellidos}
                      </span>
                      <Badge variant="outline" size="sm">
                        {passengerTypeLabel(pax.tipo)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-line pt-2 text-small">
                      <span className="text-muted">Boleto electrónico</span>
                      <span className="num font-semibold text-ink">{pax.eTicket || 'Pendiente'}</span>
                    </div>
                    {pax.asientos && pax.asientos.length > 0 && (
                      <div className="flex items-center justify-between gap-2 text-small">
                        <span className="text-muted">Asiento{pax.asientos.length > 1 ? 's' : ''}</span>
                        <span className="num font-medium text-ink">{pax.asientos.map((a) => `${a.numeroVuelo} ${a.asiento}`).join(', ')}</span>
                      </div>
                    )}
                    {pax.qr && (
                      <div className="flex justify-center border-t border-line pt-3">
                        <TicketQr code={pax.qr} passengerName={`${pax.nombres} ${pax.apellidos}`} />
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </section>

            {isGuest && (
              <Card className="flex flex-col gap-4 border-gold-text/40 bg-gold-soft sm:flex-row sm:items-center sm:justify-between print:hidden">
                <div className="flex items-start gap-3">
                  <UserPlus className="mt-0.5 h-6 w-6 shrink-0 text-gold-text" aria-hidden="true" />
                  <div>
                    <h2 className="font-semibold text-ink">Guarda este viaje en una cuenta</h2>
                    <p className="text-small text-muted">Con una cuenta gratuita ves todos tus viajes en un solo lugar y compras más rápido. Ya completamos tus datos.</p>
                  </div>
                </div>
                <Link
                  to={`/registro?${registerParams.toString()}`}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-small font-medium text-on-ink hover:bg-ink/90"
                >
                  Crear cuenta
                </Link>
              </Card>
            )}

            <section className="space-y-2 border-t border-line pt-5 text-small text-muted" aria-labelledby="antes-de-viajar">
              <h2 id="antes-de-viajar" className="flex items-center gap-2 font-semibold text-ink">
                <Mail className="h-4 w-4 text-gold-text" aria-hidden="true" />
                Antes de viajar
              </h2>
              <p>
                Lleva tu documento de viaje original y vigente. Llega al aeropuerto con 2 horas de anticipación en vuelos regionales y 3 horas en intercontinentales. Para ver esta reserva otra vez usa tu código ({orden.pnr}) y tu apellido en{' '}
                <Link to="/recuperar-orden" className="font-medium text-gold-text underline">
                  Gestionar viaje
                </Link>
                .
              </p>
              <p>Compra de prueba: no se cobró nada y estos boletos no sirven para volar.</p>
            </section>
          </>
        ) : null}

        <div className="pt-2 text-center print:hidden">
          <Link to="/" className="inline-flex min-h-[44px] items-center text-small font-medium text-muted hover:text-ink">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
};
