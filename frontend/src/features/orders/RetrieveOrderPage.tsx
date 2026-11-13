import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, Plane, Printer, Search, Ticket, User } from 'lucide-react';
import { recuperarOrden, vincularOrden } from '../../api/endpoints/orders';
import type { OrdenViewDto } from '../../api/types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { TicketQr } from '../../components/common/TicketQr';
import { timeZoneOf } from '../../lib/airports';
import { fareFamilyLabel, formatDateTime, orderStatusLabel, passengerTypeLabel } from '../../lib/labels';
import { orderStatusInfo, type OrderStatusIcon } from '../../lib/order-status';
import { saveLastOrder } from '../../lib/storage';
import { useSession } from '../../lib/session';
import { useToast } from '../../lib/toast';

const STATUS_ICONS: Record<OrderStatusIcon, React.ReactNode> = {
  ok: <CheckCircle2 />,
  plane: <Plane />,
  clock: <Clock />,
  alert: <AlertCircle />,
};

export const RetrieveOrderPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [apellido, setApellido] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; apellido?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [orden, setOrden] = useState<OrdenViewDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const toast = useToast();

  useEffect(() => {
    document.title = 'Gestionar viaje | RAM Alliance';
  }, []);

  const session = useSession();
  const [linkState, setLinkState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [linkError, setLinkError] = useState<unknown>(null);

  const addToAccount = async () => {
    if (!orden) return;
    setLinkState('busy');
    setLinkError(null);
    try {
      await vincularOrden({ numero: orden.numeroOrden, apellido: apellido.trim() });
      setLinkState('done');
      toast.success('Viaje agregado', 'Lo verás en Mis viajes.');
    } catch (err) {
      setLinkError(err);
      setLinkState('idle');
    }
  };

  const handleRetrieve = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const errors: { identifier?: string; apellido?: string } = {};
    if (!identifier.trim()) errors.identifier = 'Escribe tu código de reserva o tu número de orden.';
    if (!apellido.trim()) errors.apellido = 'Escribe el apellido de uno de los pasajeros.';
    setFieldErrors(errors);
    if (errors.identifier || errors.apellido) {
      window.setTimeout(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }

    setIsLoading(true);
    setError(null);
    setOrden(null);
    setLinkState('idle');
    setLinkError(null);

    const isOrderNumber = identifier.trim().toUpperCase().startsWith('ORD-');

    try {
      const data = await recuperarOrden({
        numero: isOrderNumber ? identifier.trim().toUpperCase() : undefined,
        pnr: !isOrderNumber ? identifier.trim().toUpperCase() : undefined,
        apellido: apellido.trim(),
      });
      setOrden(data);
      saveLastOrder(data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const info = orden ? orderStatusInfo(orden.estado) : null;

  return (
    <div className="bg-paper px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Gestiona tu viaje"
          description="Escribe tu código de reserva (6 caracteres) o tu número de orden, y el apellido de uno de los pasajeros."
        />

        <div className="mb-8 rounded-xl border border-line bg-surface p-6 sm:p-8">
          <form onSubmit={handleRetrieve} noValidate className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Código de reserva o número de orden"
                placeholder="ABC123 u ORD-7K3M9PQ2XA"
                autoComplete="off"
                value={identifier}
                error={fieldErrors.identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (fieldErrors.identifier) setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
                }}
              />
              <Input
                label="Apellido del pasajero"
                placeholder="Pérez"
                autoComplete="family-name"
                value={apellido}
                error={fieldErrors.apellido}
                onChange={(e) => {
                  setApellido(e.target.value);
                  if (fieldErrors.apellido) setFieldErrors((prev) => ({ ...prev, apellido: undefined }));
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="gap-2">
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>Buscar reserva</span>
              </Button>
              <p className="text-small text-muted">
                ¿Necesitas ayuda?{' '}
                <Link to="/ayuda#recuperar" className="font-medium text-gold-text underline underline-offset-2 hover:text-ink">
                  Mira cómo recuperar tu reserva
                </Link>
              </p>
            </div>
          </form>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {isLoading ? 'Buscando tu reserva...' : orden ? `Reserva encontrada: orden ${orden.numeroOrden}, estado ${orderStatusLabel(orden.estado)}.` : ''}
        </p>
        {error != null && <ProblemAlert error={error} className="mb-6" />}

        {orden && info && (
          <div className="space-y-6 rounded-xl border border-line bg-surface p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
              <div>
                <span className="block text-small text-muted">Código de reserva</span>
                <span className="num text-heading font-semibold text-ink">{orden.pnr || 'No asignado'}</span>
                <span className="num mt-0.5 block text-small text-muted">Orden {orden.numeroOrden}</span>
              </div>

              <Badge variant={info.tone} icon={STATUS_ICONS[info.icon]}>
                {orderStatusLabel(orden.estado)}
              </Badge>
            </div>

            <section aria-labelledby="itinerario">
              <h2 id="itinerario" className="mb-3 text-lead font-semibold text-ink">
                Itinerario
              </h2>
              <div className="space-y-3">
                {orden.itinerarios?.map((itin, idx) => (
                  <div key={idx} className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-paper p-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-chrome p-2.5 text-white">
                        <Plane className="h-4 w-4 -rotate-45" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="text-body font-medium text-ink">
                          {itin.origen} a {itin.destino} <span className="num text-small font-normal text-muted">Vuelo {itin.numeroVuelo}</span>
                        </div>
                        <div className="text-small text-muted">
                          Operado por {(itin.operador as { nombre?: string })?.nombre} · Tarifa {fareFamilyLabel(itin.familia)}
                        </div>
                      </div>
                    </div>

                    <div className="num text-small text-muted sm:text-right">
                      <div>Sale: {formatDateTime(itin.salida, timeZoneOf(itin.origen))}</div>
                      <div>Llega: {formatDateTime(itin.llegada, timeZoneOf(itin.destino))}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="pasajeros">
              <h2 id="pasajeros" className="mb-3 text-lead font-semibold text-ink">
                Pasajeros y billetes
              </h2>
              <div className="space-y-2">
                {orden.pasajeros?.map((pax) => (
                  <div key={pax.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3 text-small">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted" aria-hidden="true" />
                      <span className="font-medium text-ink">
                        {pax.nombres} {pax.apellidos}
                      </span>
                      <span className="text-muted">({passengerTypeLabel(pax.tipo)})</span>
                    </div>

                    {pax.eTicket && (
                      <div className="flex items-center gap-3">
                        <div className="num flex items-center gap-1.5 rounded-md bg-ink/5 px-2 py-1 text-ink">
                          <Ticket className="h-3.5 w-3.5 text-gold-text" aria-hidden="true" />
                          <span>Billete {pax.eTicket}</span>
                        </div>
                        {pax.qr && <TicketQr code={pax.qr} size={72} passengerName={`${pax.nombres} ${pax.apellidos}`} />}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {session?.kind === 'customer' && (
              <div className="rounded-xl border border-line bg-paper p-4 text-small">
                {linkState === 'done' ? (
                  <p className="font-medium text-success" role="status">
                    Agregado a tu cuenta. Lo verás en{' '}
                    <Link to="/mis-ordenes" className="underline underline-offset-2">
                      Mis viajes
                    </Link>
                    .
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-muted">¿Es tu viaje? Guárdalo en tu cuenta.</span>
                    <Button type="button" variant="outline" size="sm" onClick={addToAccount} isLoading={linkState === 'busy'}>
                      Agregar a mis viajes
                    </Button>
                  </div>
                )}
                {linkError != null && <ProblemAlert error={linkError} className="mt-3" />}
              </div>
            )}

            <div className="flex flex-col justify-between gap-4 border-t border-line pt-4 sm:flex-row sm:items-center">
              <div>
                <span className="block text-small text-muted">Total pagado</span>
                <div className="num text-ink">
                  <MoneyText amount={orden.total?.monto} currency={orden.total?.moneda} size="xl" />
                </div>
              </div>

              <ButtonLink to={`/confirmacion/${orden.numeroOrden}`} state={{ orden }} variant="primary" className="gap-2">
                <Printer className="h-4 w-4" aria-hidden="true" />
                Ver e imprimir comprobante
              </ButtonLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
