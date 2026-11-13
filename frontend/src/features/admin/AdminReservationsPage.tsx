import React, { useMemo, useState } from 'react';
import { Download, Users, Ticket } from 'lucide-react';
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
} from '../../api/endpoints/admin';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../../components/ui/Table';
import { useToast } from '../../lib/toast';
import { AdminPageHeader } from './AdminPageHeader';
import { FilterPanel } from './FilterPanel';
import { formatAdminDateTime } from '../../lib/labels';
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
  CONFIRMED: 'bg-success-soft text-success',
  CANCELLED: 'bg-danger-soft text-danger',
};
const statusTone = (status: string) => STATUS_TONE[status] ?? 'bg-line text-ink';
const statusLabel = (status: string) => BOOKING_STATUS_LABEL[status as keyof typeof BOOKING_STATUS_LABEL] ?? status;

const CheckInBadge: React.FC<{ booking: Pick<AdminReserva, 'pasajeros'> }> = ({ booking }) => {
  const state = checkInState(booking);
  const tone = state === 'COMPLETO' ? 'bg-success-soft text-success' : state === 'PARCIAL' ? 'bg-warning-soft text-warning' : 'bg-line text-ink';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{CHECK_IN_LABEL[state]}</span>;
};

/** Compact breakdown for the list: base + taxes = total, and what a cancellation gave back. */
const ImportesCompactos: React.FC<{ booking: AdminReserva }> = ({ booking }) => {
  const i = importesOf(booking);
  return (
    <div className="space-y-0.5">
      <div className="font-semibold text-ink">
        <MoneyText amount={i.total} currency={i.moneda} size="sm" />
      </div>
      {(i.base != null || i.impuestos != null) && (
        <div className="text-small text-muted">
          Base {i.base ?? '—'} · Imp. {i.impuestos ?? '—'}
        </div>
      )}
      {isCancelled(booking) && (i.reembolso != null || i.penalidad != null) && (
        <div className="text-small text-danger">
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
    <dl className="grid grid-cols-2 gap-3 rounded-lg bg-paper p-3 text-xs sm:grid-cols-5" aria-label="Desglose de importes">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="font-medium text-muted">{label}</dt>
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
          <span className="font-semibold text-ink">{p.nombre}</span>{' '}
          <span className="num text-muted">
            {documentTypeLabel(p.tipoDocumento)} {maskDocument(p.documento)}
          </span>
          {sharedIds.has(p.travellerId) && (
            <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-medium text-gold-text" title={`Pasajero ${p.travellerId}`}>
              <Users className="h-3 w-3" aria-hidden="true" />
              Mismo pasajero
            </span>
          )}
          <div className="text-muted">
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
  const toast = useToast();

  const booking = detail.data;
  const busy = checkIn.isPending || quote.isPending || cancel.isPending;
  const quoteData = quote.data;

  const resetFeedback = () => {
    checkIn.reset();
    quote.reset();
    cancel.reset();
  };

  const doCheckIn = () => {
    resetFeedback();
    setConfirming(false);
    checkIn.mutate(bookingId, {
      onSuccess: (r) => toast.success(`Check-in hecho: ${r.checkedInPassengers.length} pasajero(s).`),
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
          toast.success('Reserva cancelada', `Reembolso ${r.refundAmount} ${r.currency}; penalidad ${r.penaltyAmount} ${r.currency}.`);
          setConfirming(false);
          quote.reset();
        },
      },
    );
  };

  return (
    <>
    <Dialog isOpen={!confirming} onClose={onClose} title={booking ? `Reserva ${booking.pnr}` : 'Reserva'} maxWidth="2xl">
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
              <dt className="text-small font-medium text-muted">Estado</dt>
              <dd className="mt-1">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(booking.status)}`}>{statusLabel(booking.status)}</span>
              </dd>
            </div>
            <div>
              <dt className="text-small font-medium text-muted">Canal</dt>
              <dd className="mt-1 font-semibold">{canalLabel(booking.canal)}</dd>
            </div>
            <div>
              <dt className="text-small font-medium text-muted">Check-in</dt>
              <dd className="mt-1">
                <CheckInBadge booking={booking} />
              </dd>
            </div>
            <div>
              <dt className="text-small font-medium text-muted">Orden del socio</dt>
              <dd className="mt-1 break-all num text-xs">{booking.socio?.partnerOrderId ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-small font-medium text-muted">Referencia de pago</dt>
              <dd className="mt-1 break-all num text-xs">
                {booking.paymentReference}
                {booking.paymentProvider ? ` · ${booking.paymentProvider}` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-small font-medium text-muted">Monto cobrado</dt>
              <dd className="mt-1">
                <MoneyText amount={booking.total.total} currency={booking.total.currency} />
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-2 text-small font-semibold text-ink">Importes ({importesOf(booking).moneda})</h3>
            <ImportesDetalle booking={booking} />
            {importesOf(booking).base == null && <p className="mt-1 text-small text-muted">Sin desglose de base e impuestos para esta reserva: solo se conoce el total cobrado.</p>}
          </div>

          {booking.canal === 'SOCIO' && (
            <p className="rounded-lg bg-gold-soft p-3 text-small text-ink">Esta reserva se ve en Booking en unos segundos: los cambios llegan por el feed de eventos del socio.</p>
          )}

          <div>
            <h3 className="mb-2 text-small font-semibold text-ink">Vuelos</h3>
            <ul className="space-y-1.5">
              {booking.vuelos.map((v) => (
                <li key={v.vueloId} className="flex flex-wrap justify-between gap-2 rounded-lg bg-paper px-3 py-2 text-xs">
                  <span className="font-bold">
                    {v.codigoVuelo} · {v.origen} → {v.destino}
                  </span>
                  <span>
                    {formatAdminDateTime(v.salida)} · {v.estado}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-small font-semibold text-ink">Pasajeros ({booking.billetes} billete(s))</h3>
            <PassengerList booking={booking} sharedIds={new Set()} />
          </div>

          <div>
            <h3 className="mb-2 text-small font-semibold text-ink">Historial</h3>
            {booking.cambios.length === 0 ? (
              <p className="text-xs text-muted">Sin cambios registrados desde la emisión.</p>
            ) : (
              <ol className="space-y-1 text-xs text-muted">
                {booking.cambios.map((c, index) => (
                  <li key={index}>
                    {formatAdminDateTime(c.en)} · {c.descripcion}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="space-y-3 border-t border-line pt-4" aria-live="polite">
            <h3 className="text-small font-semibold text-ink">Acciones de mostrador</h3>
            {checkIn.error != null && <ProblemAlert error={checkIn.error} message={adminErrorMessage(checkIn.error, 'checkin-reserva')} />}
            {quote.error != null && <ProblemAlert error={quote.error} message={adminErrorMessage(quote.error, 'cotizar-reserva')} />}

            {quoteData && (
              <dl className="grid grid-cols-2 gap-3 rounded-lg bg-paper p-3 text-xs sm:grid-cols-4" aria-label="Cotización de cancelación">
                <div>
                  <dt className="font-medium text-muted">Reembolso</dt>
                  <dd className="mt-1 font-bold">
                    <MoneyText amount={quoteData.refundAmount} currency={quoteData.currency} />
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted">Penalidad</dt>
                  <dd className="mt-1 font-bold">
                    <MoneyText amount={quoteData.penaltyAmount} currency={quoteData.currency} />
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted">Tarifa</dt>
                  <dd className="mt-1">{quoteData.isRefundable ? 'Reembolsable' : 'No reembolsable (solo impuestos)'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted">Vence</dt>
                  <dd className="mt-1">{formatAdminDateTime(quoteData.expiresAt)}</dd>
                </div>
              </dl>
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
            {!quoteData && !isCancelled(booking) && <p className="text-small text-muted">Para cancelar, primero cotiza: se confirma con el reembolso y la penalidad a la vista.</p>}
          </div>
        </div>
      )}
    </Dialog>
    <ConfirmDialog
      isOpen={confirming && Boolean(quoteData) && Boolean(booking)}
      title={`Cancelar la reserva ${booking?.pnr ?? ''}`}
      confirmLabel="Sí, cancelar reserva"
      cancelLabel="Volver"
      destructive
      isLoading={cancel.isPending}
      error={cancel.error}
      errorMessage={adminErrorMessage(cancel.error, 'cancelar-reserva')}
      onConfirm={doCancel}
      onClose={() => setConfirming(false)}
    >
      {quoteData && (
        <p>
          Se reembolsa {quoteData.refundAmount} {quoteData.currency} y se cobra una penalidad de {quoteData.penaltyAmount} {quoteData.currency}.
        </p>
      )}
    </ConfirmDialog>
    </>
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
  const toast = useToast();

  const doExport = () => {
    exportCsv.mutate(filters, { onSuccess: (filename) => toast.success(`Descargado ${filename}.`) });
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
      <AdminPageHeader
        page="reservas"
        description="Reservas de todos los canales. Busca por localizador, orden del socio, referencia de pago o documento del pasajero; haz check-in o cancela por el viajero. Las horas se muestran en hora de Ecuador."
      />
      <FilterPanel defaultOpen activeCount={Object.keys(filters).length}>
      <form onSubmit={apply} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Localizador (PNR)" placeholder="Ej. ABC123" maxLength={6} value={draft.pnr} onChange={(e) => set('pnr', e.target.value)} />
        <Input label="Orden del socio" placeholder="Número de orden del socio" value={draft.partnerOrderId} onChange={(e) => set('partnerOrderId', e.target.value)} />
        <Input label="Referencia de pago" placeholder="Referencia del pago" value={draft.paymentReference} onChange={(e) => set('paymentReference', e.target.value)} />
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
        <Input label="Nacionalidad" maxLength={2} placeholder="Ej. EC" value={draft.nacionalidad} onChange={(e) => set('nacionalidad', e.target.value.toUpperCase())} />
        <Select label="Estado" value={draft.estado} onChange={(e) => set('estado', e.target.value as ReservasSearchForm['estado'])}>
          <option value="">Todos</option>
          {ESTADOS_RESERVA.map((s) => (
            <option key={s} value={s}>
              {BOOKING_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Input label="Creadas desde (día UTC)" type="date" value={draft.desde} max={draft.hasta || undefined} onChange={(e) => set('desde', e.target.value)} />
        <Input label="Creadas hasta (día UTC)" type="date" value={draft.hasta} min={draft.desde || undefined} onChange={(e) => set('hasta', e.target.value)} />
        <p className="text-small text-muted sm:col-span-2 lg:col-span-1">
          Estas fechas se cuentan en UTC, 5 horas por delante de Ecuador: una reserva hecha después de las 19:00 en Ecuador cuenta como del día siguiente.
        </p>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="primary" className="flex-1">
            Buscar
          </Button>
          <Button type="button" variant="outline" onClick={clear}>
            Limpiar
          </Button>
        </div>
      </form>
      </FilterPanel>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="text-small text-muted">El CSV usa los filtros aplicados (sin paginar, hasta 5000 reservas) y no incluye datos de pasajeros.</p>
        <Button type="button" variant="outline" size="sm" isLoading={exportCsv.isPending} onClick={doExport}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Exportar CSV
        </Button>
      </div>
      {exportCsv.error != null && <ProblemAlert error={exportCsv.error} message={adminErrorMessage(exportCsv.error, 'exportar-reservas')} className="mb-4" />}

      {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-4" />}

      {shared.length > 0 && (
        <div role="status" className="mb-4 rounded-xl border border-line bg-gold-soft p-3 text-small text-ink">
          {shared.map((t) => (
            <p key={t.travellerId}>
              <strong>Mismo pasajero:</strong> {t.nombre} ({documentTypeLabel(t.tipoDocumento)} {maskDocument(t.documento)}) tiene {t.bookingIds.length} reservas ({t.pnrs.join(', ')}) con un único identificador de pasajero{' '}
              <span className="num">{t.travellerId}</span>.
            </p>
          ))}
        </div>
      )}

      <Table label="Reservas de todos los canales" className="min-w-[1100px]" aria-busy={isFetching}>
        <TableHead>
          <tr>
            <TableHeaderCell>Reserva</TableHeaderCell>
            <TableHeaderCell>Canal / orden del socio</TableHeaderCell>
            <TableHeaderCell>Importes / pago</TableHeaderCell>
            <TableHeaderCell>Vuelos</TableHeaderCell>
            <TableHeaderCell>Pasajeros, asientos</TableHeaderCell>
            <TableHeaderCell>Check-in</TableHeaderCell>
            <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
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
            <TableRow key={b.bookingId}>
              <TableCell>
                <div className="num font-semibold text-ink">{b.pnr}</div>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(b.status)}`}>{statusLabel(b.status)}</span>
                <div className="num mt-1 text-small text-muted">{formatAdminDateTime(b.creadaEn)}</div>
              </TableCell>
              <TableCell className="text-small">
                <div className="font-medium">{canalLabel(b.canal)}</div>
                <div className="num break-all text-muted">{b.socio?.partnerOrderId ?? '—'}</div>
              </TableCell>
              <TableCell className="text-small">
                <ImportesCompactos booking={b} />
                <div className="num mt-1 break-all text-muted">{b.paymentReference}</div>
              </TableCell>
              <TableCell className="text-small">
                {b.vuelos.map((v) => (
                  <div key={v.vueloId}>
                    <strong>{v.codigoVuelo}</strong> {v.origen} → {v.destino}
                    <div className="num text-muted">{formatAdminDateTime(v.salida)}</div>
                  </div>
                ))}
              </TableCell>
              <TableCell>
                <PassengerList booking={b} sharedIds={sharedIdsOf(b, shared)} />
              </TableCell>
              <TableCell>
                <CheckInBadge booking={b} />
              </TableCell>
              <TableCell className="text-right">
                <Button type="button" size="sm" variant="outline" aria-label={`Ver la reserva ${b.pnr}`} onClick={() => setOpenId(b.bookingId)}>
                  Detalle
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!isLoading && items.length === 0 && !error && (
        <EmptyState icon={<Ticket />} title="No hay reservas con estos filtros" description="Quita algún filtro o revisa el localizador." />
      )}

      {data && data.total > 0 && (
        <nav aria-label="Paginación de reservas" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
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
