import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Receipt } from 'lucide-react';
import { useCancelarReservaExterna, useMisReservasExternas } from '../../api/endpoints/experiencias';
import { ProblemDetailsError } from '../../api/problem-details';
import type { ReservaExternaView } from '../../api/types';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { estadoReserva, puedeCancelarReserva, sinCancelacionGratis, TEXTO_SIN_CANCELACION_GRATIS } from '../../lib/experiencias';
import { formatDateTime, formatDay } from '../../lib/labels';
import { useSession } from '../../lib/session';
import { generateUUID } from '../../lib/uuid';
import { ConfirmDialog } from '../admin/ConfirmDialog';

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
  const [notice, setNotice] = useState<string | null>(null);
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
          setNotice(`Cancelamos «${target.experiencia.nombre}». El reembolso va a tu medio de pago.`);
          close();
        },
        onError: (err) => {
          if (err instanceof ProblemDetailsError && err.status !== 503) setKey(generateUUID());
        },
      },
    );
  };

  return (
    <div className="bg-airline-sand px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-brand-black sm:text-3xl">Mis experiencias</h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">Tus reservas de atracciones y actividades, de la más reciente a la más antigua.</p>
          </div>
          <Link to="/experiencias">
            <Button variant="accent" size="sm" tabIndex={-1}>
              Explorar experiencias
            </Button>
          </Link>
        </div>

        {notice && (
          <div role="status" className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p>{notice}</p>
            <button type="button" className="text-xs font-semibold underline" onClick={() => setNotice(null)}>
              Cerrar aviso
            </button>
          </div>
        )}

        {!session ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <Compass className="mx-auto mb-3 h-12 w-12 text-slate-300" aria-hidden="true" />
            <h2 className="mb-1 text-lg font-bold text-slate-800">Inicia sesión para ver tus experiencias</h2>
            <p className="mb-6 text-xs text-slate-500">Si reservaste como invitado, solo las ves mientras dure esa sesión del navegador.</p>
            <Link to="/login?next=%2Fmis-experiencias">
              <Button variant="primary" tabIndex={-1}>
                Iniciar sesión
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-6" />}
            {isLoading ? (
              <div className="space-y-4" role="status" aria-busy="true" aria-label="Cargando">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-36 rounded-2xl" />
                ))}
              </div>
            ) : reservas.length > 0 ? (
              <ul className="space-y-4">
                {reservas.map((r) => {
                  const estado = estadoReserva(r.estado);
                  return (
                    <li key={r.id} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                        <div>
                          <h2 className="text-base font-black text-brand-black">{r.experiencia.nombre}</h2>
                          <p className="text-xs text-slate-500">Ofrece {r.experiencia.proveedor}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${estado.className}`}>{estado.label}</span>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 text-xs sm:grid-cols-4">
                        <div>
                          <dt className="font-bold uppercase tracking-wider text-slate-500">Cuándo</dt>
                          <dd className="mt-1 text-sm text-slate-900">
                            {formatDay(`${r.fecha}T12:00:00Z`)}
                            {r.hora ? `, ${r.hora}` : ''}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold uppercase tracking-wider text-slate-500">Personas</dt>
                          <dd className="mt-1 text-sm text-slate-900">{r.cantidad}</dd>
                        </div>
                        <div>
                          <dt className="font-bold uppercase tracking-wider text-slate-500">Total</dt>
                          <dd className="mt-1"><MoneyText amount={r.total.monto} currency={r.total.moneda} /></dd>
                        </div>
                        <div>
                          <dt className="font-bold uppercase tracking-wider text-slate-500">Código del proveedor</dt>
                          <dd className="mt-1 break-all font-mono text-sm text-slate-900">{r.referenciaProveedor ?? '—'}</dd>
                        </div>
                      </dl>
                      {r.estado === 'FALLIDA_COMPENSADA' && (
                        <p className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-800">No se pudo confirmar con el proveedor y no se te cobró.{r.motivo ? ` Motivo: ${r.motivo}` : ''}</p>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                        <div className="text-xs text-slate-500">
                          <span className="block">Reservada el {formatDateTime(r.creadaEn)} UTC</span>
                          {r.factura && (
                            <span className="mt-1 inline-flex items-center gap-1.5 font-semibold text-slate-700">
                              <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                              Factura <span className="font-mono">{r.factura}</span>
                            </span>
                          )}
                        </div>
                        {puedeCancelarReserva(r.estado, r.cancelacionGratis) && (
                          <Button type="button" size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => open(r)} aria-label={`Cancelar la reserva de ${r.experiencia.nombre}`}>
                            Cancelar reserva
                          </Button>
                        )}
                        {sinCancelacionGratis(r.estado, r.cancelacionGratis) && (
                          <p className="text-xs font-semibold text-slate-600">{TEXTO_SIN_CANCELACION_GRATIS}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              !error && (
                <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                  <Compass className="mx-auto mb-3 h-12 w-12 text-slate-300" aria-hidden="true" />
                  <h2 className="mb-1 text-lg font-bold text-slate-800">Aún no tienes experiencias</h2>
                  <p className="mb-6 text-xs text-slate-500">Cuando reserves una actividad, aparecerá aquí.</p>
                  <Link to="/experiencias">
                    <Button variant="primary" tabIndex={-1}>
                      Explorar experiencias
                    </Button>
                  </Link>
                </div>
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
            <p className="mt-2 text-xs text-slate-500">Primero se cancela con el proveedor y después se devuelve el pago. Solo las experiencias con cancelación gratuita lo permiten.</p>
            <div className="mt-3">
              <Input label="Motivo (opcional)" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
};
