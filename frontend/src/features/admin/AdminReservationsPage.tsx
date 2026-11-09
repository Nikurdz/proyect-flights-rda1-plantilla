import React, { useMemo, useState } from 'react';
import { Download, Users } from 'lucide-react';
import {
  useAdminReserva,
  useAdminReservas,
  useCancelarReserva,
  useCheckInMostrador,
  useCotizarCancelacion,
  useExportarReservasCsv,
  ESTADOS_RESERVA,
  type AdminReserva,
  type AdminReservasFilters,
  type CancelacionResultado,
} from '../../api/endpoints/admin';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDateTime } from '../../lib/labels';
import { useSession } from '../../lib/session';
import { adminErrorMessage } from './admin-errors';
import {
  BOOKING_STATUS_LABEL,
  CHECK_IN_LABEL,
  EMPTY_SEARCH,
  importesOf,
  canalLabel,
  checkInState,
  documentTypeLabel,
  flightCodesOf,
  isCancelled,
  maskDocument,
  seatsText,
  sharedIdsOf,
  sharedTravellers,
  toReservasFilters,
  type ReservasSearchForm,
} from './reservas';

const STATUS_TONE: Record<string, string> = {
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
};
const statusTone = (status: string) => STATUS_TONE[status] ?? 'bg-slate-100 text-slate-700';

const CheckInBadge: React.FC<{ booking: Pick<AdminReserva, 'pasajeros'> }> = ({ booking }) => {
  const state = checkInState(booking);
  const tone = state === 'COMPLETO' ? 'bg-emerald-100 text-emerald-800' : state === 'PARCIAL' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{CHECK_IN_LABEL[state]}</span>;
};

/** Compact breakdown for the list: base + taxes = total, and what a cancellation gave back. */
const ImportesCompactos: React.FC<{ booking: AdminReserva }> = ({ booking }) => {
  const i = importesOf(booking);
  return (
    <div className="space-y-0.5">
      <div className="font-bold text-brand-black">
        <MoneyText amount={i.total} currency={i.moneda} size="sm" />
      </div>
      {(i.base != null || i.impuestos != null) && (
        <div className="text-[11px] text-slate-600">
          Base {i.base ?? '—'} · Imp. {i.impuestos ?? '—'}
        </div>
      )}
      {isCancelled(booking) && (i.reembolso != null || i.penalidad != null) && (
        <div className="text-[11px] text-red-700">
          Reemb. {i.reembolso ?? '—'} · Pen. {i.penalidad ?? '—'}
        </div>
      )}
    </div>
  );
};

/** Full breakdown for the detail dialog. */
const ImportesDetalle: React.FC<{ booking: AdminReserva }> = ({ booking }) => {
  const i = importesOf(booking);
  const rows: [string, string | null][] = [
    ['Base', i.base],
    ['Impuestos', i.impuestos],
    ['Total cobrado', i.total],
  ];
  if (isCancelled(booking)) rows.push(['Reembolso', i.reembolso], ['Penalidad', i.penalidad]);
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-5" aria-label="Desglose de importes">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="font-semibold uppercase text-slate-500">{label}</dt>
          <dd className={`mt-1 ${label === 'Total cobrado' ? 'font-black' : 'font-bold'}`}>{value == null ? '—' : <MoneyText amount={value} currency={i.moneda} size="sm" />}</dd>
        </div>
      ))}
    </dl>
  );
};

const PassengerList: React.FC<{ booking: AdminReserva; sharedIds: Set<string> }> = ({ booking, sharedIds }) => {
  const codes = flightCodesOf(booking);
  return (
    <ul className="space-y-1.5">
      {booking.pasajeros.map((p) => (
        <li key={p.passengerId} className="text-xs">
          <span className="font-semibold text-brand-black">{p.nombre}</span>{' '}
          <span className="font-mono text-slate-600">
            {documentTypeLabel(p.tipoDocumento)} {maskDocument(p.documento)}
          </span>
          {sharedIds.has(p.travellerId) && (
            <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800" title={`Pasajero ${p.travellerId}`}>
              <Users className="h-3 w-3" aria-hidden="true" />
              Mismo pasajero
            </span>
          )}
          <div className="text-slate-600">
            {seatsText(p, codes)} · {p.checkIn ? 'check-in hecho' : 'sin check-in'}
          </div>
        </li>
      ))}
    </ul>
  );
};

const ReservationDetailDialog: React.FC<{ bookingId: string; ownerId?: string; onClose: () => void }> = ({ bookingId, ownerId, onClose }) => {
  const detail = useAdminReserva(bookingId, ownerId);
  const checkIn = useCheckInMostrador();
  const quote = useCotizarCancelacion();
  const cancel = useCancelarReserva();
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState<CancelacionResultado | null>(null);

  const booking = detail.data;
  const busy = checkIn.isPending || quote.isPending || cancel.isPending;
  const quoteData = quote.data;

  const resetFeedback = () => {
    checkIn.reset();
    quote.reset();
    cancel.reset();
    setNotice(null);
  };

  const doCheckIn = () => {
    resetFeedback();
    setConfirming(false);
    checkIn.mutate(bookingId, {
      onSuccess: (r) => setNotice(`Check-in hecho: ${r.checkedInPassengers.length} pasajero(s).`),
    });
  };

  const doQuote = () => {
    resetFeedback();
    setConfirming(false);
    quote.mutate(bookingId);
  };

  const doCancel = () => {
    if (!quoteData) return;
    cancel.mutate(
      { bookingId, quoteId: quoteData.quoteId },
      {
        onSuccess: (r) => {
          setCancelled(r);
          setConfirming(false);
          quote.reset();
        },
      },
    );
  };

  return (
    <Dialog isOpen onClose={onClose} title={booking ? `Reserva ${booking.pnr}` : 'Reserva'} maxWidth="2xl">
      {detail.error != null ? (
        <ProblemAlert error={detail.error} onRetry={() => detail.refetch()} />
      ) : !booking ? (
        <div role="status" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-5 text-sm">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Estado</dt>
              <dd className="mt-1">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(booking.status)}`}>{booking.status}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Canal</dt>
              <dd className="mt-1 font-semibold">{canalLabel(booking.canal)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Check-in</dt>
              <dd className="mt-1">
                <CheckInBadge booking={booking} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Orden del socio</dt>
              <dd className="mt-1 break-all font-mono text-xs">{booking.socio?.partnerOrderId ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Referencia de pago</dt>
              <dd className="mt-1 break-all font-mono text-xs">
                {booking.paymentReference}
                {booking.paymentProvider ? ` · ${booking.paymentProvider}` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Monto cobrado</dt>
              <dd className="mt-1">
                <MoneyText amount={booking.total.total} currency={booking.total.currency} />
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Importes ({importesOf(booking).moneda})</h3>
            <ImportesDetalle booking={booking} />
            {importesOf(booking).base == null && <p className="mt-1 text-[11px] text-slate-500">Sin desglose de base e impuestos para esta reserva: solo se conoce el total cobrado.</p>}
          </div>

          {booking.canal === 'SOCIO' && (
            <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900">Esta reserva se ve en Booking en unos segundos: los cambios llegan por el feed de eventos del socio.</p>
          )}

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Vuelos</h3>
            <ul className="space-y-1.5">
              {booking.vuelos.map((v) => (
                <li key={v.vueloId} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-bold">
                    {v.codigoVuelo} · {v.origen} → {v.destino}
                  </span>
                  <span>
                    {formatDateTime(v.salida)} UTC · {v.estado}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Pasajeros ({booking.billetes} billete(s))</h3>
            <PassengerList booking={booking} sharedIds={new Set()} />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Historial</h3>
            {booking.cambios.length === 0 ? (
              <p className="text-xs text-slate-500">Sin cambios registrados desde la emisión.</p>
            ) : (
              <ol className="space-y-1 text-xs text-slate-600">
                {booking.cambios.map((c, index) => (
                  <li key={index}>
                    {formatDateTime(c.en)} UTC · {c.descripcion}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4" aria-live="polite">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Acciones de mostrador</h3>
            {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">{notice}</p>}
            {cancelled && (
              <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                Reserva cancelada. Reembolso {cancelled.refundAmount} {cancelled.currency}; penalidad {cancelled.penaltyAmount} {cancelled.currency}.
              </p>
            )}
            {checkIn.error != null && <ProblemAlert error={checkIn.error} message={adminErrorMessage(checkIn.error, 'checkin-reserva')} />}
            {quote.error != null && <ProblemAlert error={quote.error} message={adminErrorMessage(quote.error, 'cotizar-reserva')} />}
            {cancel.error != null && <ProblemAlert error={cancel.error} message={adminErrorMessage(cancel.error, 'cancelar-reserva')} />}

            {quoteData && (
              <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-4" aria-label="Cotización de cancelación">
                <div>
                  <dt className="font-semibold uppercase text-slate-500">Reembolso</dt>
                  <dd className="mt-1 font-bold">
                    <MoneyText amount={quoteData.refundAmount} currency={quoteData.currency} />
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase text-slate-500">Penalidad</dt>
                  <dd className="mt-1 font-bold">
                    <MoneyText amount={quoteData.penaltyAmount} currency={quoteData.currency} />
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase text-slate-500">Tarifa</dt>
                  <dd className="mt-1">{quoteData.isRefundable ? 'Reembolsable' : 'No reembolsable (solo impuestos)'}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase text-slate-500">Vence</dt>
                  <dd className="mt-1">{formatDateTime(quoteData.expiresAt)} UTC</dd>
                </div>
              </dl>
            )}

            {confirming && quoteData && (
              <div role="alertdialog" aria-label="Confirmar cancelación" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                <p className="font-semibold">
                  Vas a cancelar la reserva {booking.pnr}. Se reembolsa {quoteData.refundAmount} {quoteData.currency} y se cobra una penalidad de {quoteData.penaltyAmount} {quoteData.currency}. No se puede deshacer.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="danger" size="sm" isLoading={cancel.isPending} onClick={doCancel}>
                    Sí, cancelar reserva
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={cancel.isPending} onClick={() => setConfirming(false)}>
                    Volver
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="primary" size="sm" disabled={busy || isCancelled(booking)} isLoading={checkIn.isPending} onClick={doCheckIn}>
                Hacer check-in
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={busy || isCancelled(booking)} isLoading={quote.isPending} onClick={doQuote}>
                Cotizar cancelación
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={busy || isCancelled(booking) || !quoteData || confirming}
                onClick={() => setConfirming(true)}
                title={quoteData ? undefined : 'Cotiza primero la cancelación'}
              >
                Cancelar reserva
              </Button>
            </div>
            {!quoteData && !isCancelled(booking) && <p className="text-[11px] text-slate-500">Para cancelar, primero cotiza: se confirma con el reembolso y la penalidad a la vista.</p>}
          </div>
        </div>
      )}
    </Dialog>
  );
};

export const AdminReservationsPage: React.FC = () => {
  const session = useSession();
  const [draft, setDraft] = useState<ReservasSearchForm>(EMPTY_SEARCH);
  const [filters, setFilters] = useState<AdminReservasFilters>({});
  const [pagina, setPagina] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useAdminReservas({ ...filters, pagina }, session?.ownerId);
  const items = useMemo(() => data?.items ?? [], [data]);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limite)) : 1;
  const shared = useMemo(() => sharedTravellers(items), [items]);
  const exportCsv = useExportarReservasCsv();
  const [exported, setExported] = useState<string | null>(null);

  const doExport = () => {
    setExported(null);
    exportCsv.mutate(filters, { onSuccess: (filename) => setExported(filename) });
  };

  const set = <K extends keyof ReservasSearchForm>(key: K, value: ReservasSearchForm[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters(toReservasFilters(draft));
    setPagina(1);
  };

  const clear = () => {
    setDraft(EMPTY_SEARCH);
    setFilters({});
    setPagina(1);
  };

  return (
    <section aria-label="Reservas">
      <p className="mb-4 text-xs text-slate-600">
        Reservas de todos los canales. Busca por localizador, orden del socio, referencia de pago o documento del pasajero; haz check-in o cancela por el viajero. Las horas se muestran en UTC.
      </p>
      <form onSubmit={apply} className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Localizador (PNR)" placeholder="ABC123" maxLength={6} value={draft.pnr} onChange={(e) => set('pnr', e.target.value)} />
        <Input label="Orden del socio" placeholder="ORD-BKP-…" value={draft.partnerOrderId} onChange={(e) => set('partnerOrderId', e.target.value)} />
        <Input label="Referencia de pago" placeholder="PAY-BKP-…" value={draft.paymentReference} onChange={(e) => set('paymentReference', e.target.value)} />
        <Select label="Canal" value={draft.canal} onChange={(e) => set('canal', e.target.value as ReservasSearchForm['canal'])}>
          <option value="">Todos</option>
          <option value="SOCIO">Socio (Booking)</option>
          <option value="DIRECTO">Directo (web)</option>
        </Select>
        <Select label="Tipo de documento" value={draft.tipoDocumento} onChange={(e) => set('tipoDocumento', e.target.value as ReservasSearchForm['tipoDocumento'])}>
          <option value="NATIONAL_ID">Cédula</option>
          <option value="PASSPORT">Pasaporte</option>
        </Select>
        <Input label="Documento del pasajero" autoComplete="off" value={draft.documento} onChange={(e) => set('documento', e.target.value)} />
        <Input label="Nacionalidad" maxLength={2} placeholder="EC" value={draft.nacionalidad} onChange={(e) => set('nacionalidad', e.target.value.toUpperCase())} />
        <Select label="Estado" value={draft.estado} onChange={(e) => set('estado', e.target.value as ReservasSearchForm['estado'])}>
          <option value="">Todos</option>
          {ESTADOS_RESERVA.map((s) => (
            <option key={s} value={s}>
              {BOOKING_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Input label="Creadas desde (UTC)" type="date" value={draft.desde} max={draft.hasta || undefined} onChange={(e) => set('desde', e.target.value)} />
        <Input label="Creadas hasta (UTC)" type="date" value={draft.hasta} min={draft.desde || undefined} onChange={(e) => set('hasta', e.target.value)} />
        <div className="flex items-end gap-2">
          <Button type="submit" variant="primary" className="flex-1">
            Buscar
          </Button>
          <Button type="button" variant="outline" onClick={clear}>
            Limpiar
          </Button>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="text-[11px] text-slate-500">El CSV usa los filtros aplicados (sin paginar, hasta 5000 reservas) y no incluye datos de pasajeros.</p>
        <Button type="button" variant="outline" size="sm" isLoading={exportCsv.isPending} onClick={doExport}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Exportar CSV
        </Button>
      </div>
      {exported && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          Descargado {exported}.
        </p>
      )}
      {exportCsv.error != null && <ProblemAlert error={exportCsv.error} message={adminErrorMessage(exportCsv.error, 'exportar-reservas')} className="mb-4" />}

      {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-4" />}

      {shared.length > 0 && (
        <div role="status" className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          {shared.map((t) => (
            <p key={t.travellerId}>
              <strong>Mismo pasajero:</strong> {t.nombre} ({documentTypeLabel(t.tipoDocumento)} {maskDocument(t.documento)}) tiene {t.bookingIds.length} reservas ({t.pnrs.join(', ')}) con un único identificador de pasajero{' '}
              <span className="font-mono">{t.travellerId}</span>.
            </p>
          ))}
        </div>
      )}

      <div role="region" tabIndex={0} aria-label="Tabla de reservas, desplazable horizontalmente" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm" aria-busy={isFetching}>
        <table className="w-full min-w-[1100px] text-left text-sm">
          <caption className="sr-only">Reservas de todos los canales</caption>
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Reserva</th>
              <th scope="col" className="px-4 py-3">Canal / orden del socio</th>
              <th scope="col" className="px-4 py-3">Importes / pago</th>
              <th scope="col" className="px-4 py-3">Vuelos</th>
              <th scope="col" className="px-4 py-3">Pasajeros, asientos</th>
              <th scope="col" className="px-4 py-3">Check-in</th>
              <th scope="col" className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={7} className="p-4">
                  <div role="status" aria-busy="true" aria-label="Cargando">
                    <Skeleton className="h-24 w-full" />
                  </div>
                </td>
              </tr>
            )}
            {items.map((b) => (
              <tr key={b.bookingId} className="align-top hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-mono text-xs font-bold text-brand-black">{b.pnr}</div>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(b.status)}`}>{b.status}</span>
                  <div className="mt-1 text-[11px] text-slate-500">{formatDateTime(b.creadaEn)}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="font-semibold">{canalLabel(b.canal)}</div>
                  <div className="break-all font-mono text-slate-600">{b.socio?.partnerOrderId ?? '—'}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <ImportesCompactos booking={b} />
                  <div className="mt-1 break-all font-mono text-slate-600">{b.paymentReference}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {b.vuelos.map((v) => (
                    <div key={v.vueloId}>
                      <strong>{v.codigoVuelo}</strong> {v.origen} → {v.destino}
                      <div className="text-slate-500">{formatDateTime(v.salida)} UTC</div>
                    </div>
                  ))}
                </td>
                <td className="px-4 py-3">
                  <PassengerList booking={b} sharedIds={sharedIdsOf(b, shared)} />
                </td>
                <td className="px-4 py-3">
                  <CheckInBadge booking={b} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button type="button" size="sm" variant="outline" aria-label={`Ver la reserva ${b.pnr}`} onClick={() => setOpenId(b.bookingId)}>
                    Detalle
                  </Button>
                </td>
              </tr>
            ))}
            {!isLoading && items.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  No hay reservas con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <nav aria-label="Paginación de reservas" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <span>
            {data.total} reserva(s) · página {data.pagina} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={pagina <= 1 || isFetching} onClick={() => setPagina((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pagina >= totalPages || isFetching} onClick={() => setPagina((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </nav>
      )}

      {openId && <ReservationDetailDialog key={openId} bookingId={openId} ownerId={session?.ownerId} onClose={() => setOpenId(null)} />}
    </section>
  );
};
