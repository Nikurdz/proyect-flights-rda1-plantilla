import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Receipt } from 'lucide-react';
import { useCancelarReservaExterna, useMisReservasExternas } from '../../api/endpoints/experiencias';
import { ProblemDetailsError } from '../../api/problem-details';
import type { ReservaExternaView } from '../../api/types';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { estadoReserva, estadoReservaVariant, puedeCancelarReserva, sinCancelacionGratis, TEXTO_SIN_CANCELACION_GRATIS } from '../../lib/experiencias';
import { formatDateTime, formatDay } from '../../lib/labels';
import { useSession } from '../../lib/session';
import { useToast } from '../../lib/toast';
import { generateUUID } from '../../lib/uuid';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

function cancelMessage(error: unknown): string | undefined {
  if (!(error instanceof ProblemDetailsError)) return undefined;
  if (error.code === 'EXTERNAL_RESERVATION_NOT_REFUNDABLE') return 'Esta experiencia no admite cancelación gratuita, por eso no se puede cancelar aquí.';
  if (error.code === 'PROVIDER_DISABLED' || error.code === 'PROVIDER_UNAVAILABLE') return 'El proveedor no puede atender la cancelación ahora. No cambió nada: inténtalo más tarde.';
  if (error.code === 'INVALID_STATE_TRANSITION') return 'Esta reserva ya no se puede cancelar en su estado actual. Actualiza la lista.';
  return undefined;
}

/** «Mis experiencias»: the bookings of the signed-in customer (or of this session's guest), with cancellation. */
export const MyExperiencesPage: React.FC = () => {
  const session = useSession();
  const { data, isLoading, error, refetch } = useMisReservasExternas(session?.ownerId);
  const cancelar = useCancelarReservaExterna();
  const [target, setTarget] = useState<ReservaExternaView | null>(null);
  const [motivo, setMotivo] = useState('');
  const toast = useToast();
  // One Idempotency-Key per cancellation attempt; a stored failure (409) needs a fresh one.
  const [key, setKey] = useState(() => generateUUID());

  useEffect(() => {
    document.title = 'Mis experiencias | RAM Alliance';
  }, []);

  const reservas = data?.items ?? [];

  const open = (r: ReservaExternaView) => {
    setTarget(r);
    setMotivo('');
    setKey(generateUUID());
    cancelar.reset();
  };

  const close = () => {
    setTarget(null);
    cancelar.reset();
  };

  const confirm = () => {
    if (!target) return;
    cancelar.mutate(
      { id: target.id, motivo: motivo.trim() || undefined, idempotencyKey: key },
      {
        onSuccess: () => {
          toast.success('Reserva cancelada', `Cancelamos «${target.experiencia.nombre}». El reembolso va a tu medio de pago.`);
          close();
        },
        onError: (err) => {
          if (err instanceof ProblemDetailsError && err.status !== 503) setKey(generateUUID());
        },
      },
    );
  };

  return (
    <div className="bg-paper px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-heading font-semibold text-ink">Mis experiencias</h1>
            <p className="mt-1 max-w-xl text-body text-muted">Tus reservas de tours y actividades, de la más reciente a la más antigua.</p>
          </div>
          <Link to="/experiencias" className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-gold px-4 py-2.5 text-small font-medium text-on-gold transition-colors hover:bg-gold/90">
            Explorar experiencias
          </Link>
        </div>

        {!session ? (
          <EmptyState
            icon={<Compass />}
            title="Inicia sesión para ver tus experiencias"
            description="Si reservaste como invitado, solo las ves mientras dure esa sesión del navegador."
            action={
              <Link to="/login?next=%2Fmis-experiencias" className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-small font-medium text-on-ink hover:bg-ink/90">
                Iniciar sesión
              </Link>
            }
          />
        ) : (
          <>
            {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-6" />}
            {isLoading ? (
              <div className="space-y-4" role="status" aria-busy="true" aria-label="Cargando">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-36 rounded-xl" />
                ))}
              </div>
            ) : reservas.length > 0 ? (
              <ul className="space-y-4">
                {reservas.map((r) => {
                  const estado = estadoReserva(r.estado);
                  return (
                    <li key={r.id}>
                      <Card className="p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                          <div>
                            <h2 className="text-lead font-semibold text-ink">{r.experiencia.nombre}</h2>
                            <p className="text-small text-muted">Ofrece {r.experiencia.proveedor}</p>
                          </div>
                          <Badge variant={estadoReservaVariant(r.estado)}>{estado.label}</Badge>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 sm:grid-cols-4">
                          <div>
                            <dt className="text-small text-muted">Cuándo</dt>
                            <dd className="mt-1 text-ink">
                              {formatDay(`${r.fecha}T12:00:00Z`)}
                              {r.hora ? `, ${r.hora}` : ''}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-small text-muted">Personas</dt>
                            <dd className="num mt-1 text-ink">{r.cantidad}</dd>
                          </div>
                          <div>
                            <dt className="text-small text-muted">Total</dt>
                            <dd className="mt-1">
                              <MoneyText amount={r.total.monto} currency={r.total.moneda} className="num text-ink" />
                            </dd>
                          </div>
                          {r.referenciaProveedor && (
                            <div>
                              <dt className="text-small text-muted">Código del proveedor</dt>
                              <dd className="num mt-1 break-all text-ink">{r.referenciaProveedor}</dd>
                            </div>
                          )}
                        </dl>
                        {r.estado === 'FALLIDA_COMPENSADA' && (
                          <p className="mb-3 rounded-lg bg-danger-soft p-2.5 text-small text-danger">No se pudo confirmar con el proveedor y no se te cobró.{r.motivo ? ` Motivo: ${r.motivo}` : ''}</p>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                          <div className="text-small text-muted">
                            <span className="block">Reservada el {formatDateTime(r.creadaEn)}</span>
                            {r.factura && (
                              <span className="mt-1 inline-flex items-center gap-1.5 font-medium text-ink">
                                <Receipt className="h-4 w-4" aria-hidden="true" />
                                Factura <span className="num">{r.factura}</span>
                              </span>
                            )}
                          </div>
                          {puedeCancelarReserva(r.estado, r.cancelacionGratis) && (
                            <Button type="button" size="sm" variant="outline" onClick={() => open(r)} aria-label={`Cancelar la reserva de ${r.experiencia.nombre}`}>
                              Cancelar reserva
                            </Button>
                          )}
                          {sinCancelacionGratis(r.estado, r.cancelacionGratis) && <p className="text-small font-medium text-muted">{TEXTO_SIN_CANCELACION_GRATIS}</p>}
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ) : (
              !error && (
                <EmptyState
                  icon={<Compass />}
                  title="Aún no tienes experiencias"
                  description="Cuando reserves una actividad, aparecerá aquí."
                  action={
                    <Link to="/experiencias" className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-small font-medium text-on-ink hover:bg-ink/90">
                      Explorar experiencias
                    </Link>
                  }
                />
              )
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(target)}
        title="Cancelar reserva"
        confirmLabel="Sí, cancelar"
        cancelLabel="Conservar reserva"
        destructive
        isLoading={cancelar.isPending}
        error={cancelar.error}
        errorMessage={cancelMessage(cancelar.error)}
        onConfirm={confirm}
        onClose={close}
      >
        {target && (
          <>
            <p>
              Vas a cancelar <strong>{target.experiencia.nombre}</strong> del {formatDay(`${target.fecha}T12:00:00Z`)}.
            </p>
            <p className="mt-2 text-small text-muted">Primero se cancela con el proveedor y después se devuelve el pago. Solo las experiencias con cancelación gratuita lo permiten.</p>
            <div className="mt-3">
              <Input label="Motivo (opcional)" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
};
