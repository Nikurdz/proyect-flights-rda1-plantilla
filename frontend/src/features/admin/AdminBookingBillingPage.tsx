import React, { useState } from 'react';
import { AlertTriangle, Download, Receipt } from 'lucide-react';
import {
  currentMonthRange,
  useConciliacionBooking,
  useExportarConciliacionCsv,
  useResumenConciliacionBooking,
  type ConciliacionFiltros,
  type ConciliacionItem,
} from '../../api/endpoints/facturacion-booking';
import { ESTADOS_RESERVA } from '../../api/endpoints/admin';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../../components/ui/Table';
import { useToast } from '../../lib/toast';
import { FilterPanel } from './FilterPanel';
import { useSession } from '../../lib/session';
import { adminErrorMessage } from './admin-errors';
import { AdminPageHeader } from './AdminPageHeader';
import { BOOKING_STATUS_LABEL } from './reservas';

interface Form {
  desde: string;
  hasta: string;
  partnerId: string;
  estado: ConciliacionFiltros['estado'];
  soloAlertas: boolean;
}

const initialForm = (): Form => ({ ...currentMonthRange(), partnerId: '', estado: '', soloAlertas: false });

const Card: React.FC<{ label: string; children: React.ReactNode; tone?: string }> = ({ label, children, tone = 'bg-surface text-ink' }) => (
  <div className={`rounded-xl border border-line p-3 ${tone}`}>
    <div className="text-small opacity-80">{label}</div>
    <div className="num mt-1 text-lead font-semibold">{children}</div>
  </div>
);

const money = (amount: string | null, currency: string) => (amount == null ? '—' : <MoneyText amount={amount} currency={currency} size="sm" />);

const IvaAlerta: React.FC<{ item: ConciliacionItem }> = ({ item }) => (
  <div role="alert" className="mt-1 rounded-lg border border-warning bg-warning-soft p-1.5 text-small text-warning">
    <span className="inline-flex items-center gap-1 font-semibold">
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      IVA no cuadra
    </span>
    <div>
      Nuestro IVA {item.iva ?? '—'} · 15 % de la base {item.ivaEsperado ?? '—'} · Booking (incluido) {item.ivaSegunBooking}
    </div>
  </div>
);

/** ADMIN only: reconciliation of Booking's sales with the invoices Booking issues (read only, not a fiscal document). */
export const AdminBookingBillingPage: React.FC = () => {
  const session = useSession();
  const [draft, setDraft] = useState<Form>(initialForm);
  const [filters, setFilters] = useState<ConciliacionFiltros>(() => ({ ...currentMonthRange(), estado: '' }));
  const [pagina, setPagina] = useState(1);
  const toast = useToast();

  const list = useConciliacionBooking({ ...filters, pagina }, session?.ownerId);
  const summary = useResumenConciliacionBooking(filters, session?.ownerId);
  const exportCsv = useExportarConciliacionCsv();

  const items = list.data?.items ?? [];
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.limite)) : 1;
  const resumen = summary.data;
  const moneda = resumen?.moneda ?? 'USD';
  const t = resumen?.total;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({
      desde: draft.desde || undefined,
      hasta: draft.hasta || undefined,
      partnerId: draft.partnerId.trim() || undefined,
      estado: draft.estado,
      soloAlertas: draft.soloAlertas,
    });
    setPagina(1);
  };

  const clear = () => {
    setDraft(initialForm());
    setFilters({ ...currentMonthRange(), estado: '' });
    setPagina(1);
  };

  const doExport = () => {
    exportCsv.mutate(filters, { onSuccess: (filename) => toast.success(`Descargado ${filename}.`) });
  };

  return (
    <section aria-label="Facturación de Booking">
      <AdminPageHeader page="facturacion-booking" description="Compara las ventas de Booking con las facturas que Booking emite." />

      <p role="note" className="mb-4 rounded-xl border border-line bg-gold-soft p-3 text-small text-ink">
        Vista de conciliación: no es un documento fiscal. Las facturas las emite Booking (IVA 15 % incluido); aquí se comparan sus importes con los nuestros. Los días se cuentan en hora de Ecuador.
      </p>

      <FilterPanel defaultOpen activeCount={Object.entries(filters).filter(([k, v]) => v && k !== 'desde' && k !== 'hasta').length}>
      <form onSubmit={apply} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Desde (hora de Ecuador)" type="date" value={draft.desde} max={draft.hasta || undefined} onChange={(e) => set('desde', e.target.value)} />
        <Input label="Hasta (hora de Ecuador)" type="date" value={draft.hasta} min={draft.desde || undefined} onChange={(e) => set('hasta', e.target.value)} />
        <Input label="Socio" placeholder="Nombre del socio" helperText="Déjalo vacío para ver todos los socios." maxLength={60} value={draft.partnerId} onChange={(e) => set('partnerId', e.target.value)} />
        <Select label="Estado" value={draft.estado ?? ''} onChange={(e) => set('estado', e.target.value as Form['estado'])}>
          <option value="">Todos</option>
          {ESTADOS_RESERVA.map((s) => (
            <option key={s} value={s}>
              {BOOKING_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 self-end text-sm font-medium text-ink">
          <input type="checkbox" checked={draft.soloAlertas} onChange={(e) => set('soloAlertas', e.target.checked)} />
          Solo con IVA descuadrado
        </label>
        <div className="flex items-end gap-2 lg:col-start-4">
          <Button type="submit" variant="primary" className="flex-1">
            Buscar
          </Button>
          <Button type="button" variant="outline" onClick={clear}>
            Limpiar
          </Button>
        </div>
      </form>
      </FilterPanel>

      {resumen?.truncado && (
        <p role="status" className="mb-4 rounded-lg border border-warning bg-warning-soft p-3 text-small text-warning">
          El resumen se calculó con las primeras 5000 ventas del periodo. Conviene acotar las fechas.
        </p>
      )}
      {summary.error != null && <ProblemAlert error={summary.error} onRetry={() => summary.refetch()} className="mb-4" />}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5" aria-label="Totales del periodo" aria-busy={summary.isFetching}>
        {summary.isLoading || !t ? (
          summary.error == null && (
            <div role="status" aria-busy="true" aria-label="Cargando" className="col-span-full">
              <Skeleton className="h-20 w-full" />
            </div>
          )
        ) : (
          <>
            <Card label="Ventas">{t.ventas}</Card>
            <Card label="Base">{money(t.base, moneda)}</Card>
            <Card label="IVA">{money(t.iva, moneda)}</Card>
            <Card label="Total cobrado">{money(t.total, moneda)}</Card>
            <Card label="Reembolsos">{money(t.reembolsos, moneda)}</Card>
            <Card label="Penalidades">{money(t.penalidades, moneda)}</Card>
            <Card label="Equipaje + cambios de fecha">{money(String((Number(t.equipaje) + Number(t.cambiosFecha)).toFixed(2)), moneda)}</Card>
            <Card label="Neto" tone="bg-chrome text-gold">
              {money(t.neto, moneda)}
            </Card>
            <Card label="Alertas de IVA" tone={t.alertasIva > 0 ? 'bg-warning-soft text-warning' : 'bg-surface text-ink'}>
              {t.alertasIva}
            </Card>
          </>
        )}
      </div>

      {resumen && resumen.dias.length > 0 && (
        <Table label="Resumen por día de Ecuador" className="min-w-[760px]" wrapperClassName="mb-5" maxHeightClass="max-h-[50vh]">
          <TableHead>
            <tr>
              <TableHeaderCell>Día</TableHeaderCell>
              <TableHeaderCell>Ventas</TableHeaderCell>
              <TableHeaderCell>Base</TableHeaderCell>
              <TableHeaderCell>IVA</TableHeaderCell>
              <TableHeaderCell>Total</TableHeaderCell>
              <TableHeaderCell>Cancelaciones</TableHeaderCell>
              <TableHeaderCell>Reembolsos</TableHeaderCell>
              <TableHeaderCell>Neto</TableHeaderCell>
              <TableHeaderCell>Alertas</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {resumen.dias.map((d) => (
              <TableRow key={d.fecha}>
                <TableCell className="num font-semibold">{d.fecha}</TableCell>
                <TableCell className="num">{d.ventas}</TableCell>
                <TableCell>{money(d.base, moneda)}</TableCell>
                <TableCell>{money(d.iva, moneda)}</TableCell>
                <TableCell>{money(d.total, moneda)}</TableCell>
                <TableCell className="num">{d.cancelaciones}</TableCell>
                <TableCell>{money(d.reembolsos, moneda)}</TableCell>
                <TableCell className="font-semibold">{money(d.neto, moneda)}</TableCell>
                <TableCell>{d.alertasIva > 0 ? <span className="font-semibold text-warning">{d.alertasIva}</span> : 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="text-small text-muted">El CSV usa los filtros aplicados (sin paginar, hasta 5000 ventas, las más antiguas primero).</p>
        <Button type="button" variant="outline" size="sm" isLoading={exportCsv.isPending} onClick={doExport}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Exportar CSV
        </Button>
      </div>
      {exportCsv.error != null && <ProblemAlert error={exportCsv.error} message={adminErrorMessage(exportCsv.error, 'exportar-conciliacion')} className="mb-4" />}
      {list.error != null && <ProblemAlert error={list.error} onRetry={() => list.refetch()} className="mb-4" />}

      <Table label="Ventas de Booking como líneas de factura" className="min-w-[1100px]" aria-busy={list.isFetching}>
        <TableHead>
          <tr>
            <TableHeaderCell>Fecha</TableHeaderCell>
            <TableHeaderCell>PNR</TableHeaderCell>
            <TableHeaderCell>Orden del socio</TableHeaderCell>
            <TableHeaderCell>Pago</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>Base</TableHeaderCell>
            <TableHeaderCell>IVA</TableHeaderCell>
            <TableHeaderCell>IVA según Booking</TableHeaderCell>
            <TableHeaderCell>Total</TableHeaderCell>
            <TableHeaderCell>Nota de crédito</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {list.isLoading && (
            <tr>
              <td colSpan={10} className="p-4">
                <div role="status" aria-busy="true" aria-label="Cargando">
                  <Skeleton className="h-24 w-full" />
                </div>
              </td>
            </tr>
          )}
          {items.map((i) => (
            <TableRow key={i.bookingId}>
              <TableCell className="num">{i.fecha}</TableCell>
              <TableCell className="num font-semibold text-ink">{i.pnr}</TableCell>
              <TableCell className="num break-all text-muted">{i.partnerOrderId ?? '—'}</TableCell>
              <TableCell className="num break-all text-muted">{i.paymentReference}</TableCell>
              <TableCell>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${i.estado === 'CANCELLED' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'}`}>
                  {BOOKING_STATUS_LABEL[i.estado as keyof typeof BOOKING_STATUS_LABEL] ?? i.estado}
                </span>
              </TableCell>
              <TableCell>{money(i.base, i.moneda)}</TableCell>
              <TableCell>
                {money(i.iva, i.moneda)}
                {i.ivaAlerta && <IvaAlerta item={i} />}
              </TableCell>
              <TableCell>{money(i.ivaSegunBooking, i.moneda)}</TableCell>
              <TableCell className="font-semibold">{money(i.total, i.moneda)}</TableCell>
              <TableCell>
                {i.notaCredito ? (
                  <div>
                    <div className="num font-semibold text-danger">{i.notaCredito.numero}</div>
                    <div className="text-muted">Reembolso {i.notaCredito.reembolso}</div>
                    <div className="text-muted">Penalidad {i.notaCredito.penalidad}</div>
                  </div>
                ) : (
                  '—'
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!list.isLoading && items.length === 0 && !list.error && (
        <EmptyState icon={<Receipt />} title="No hay ventas de Booking con estos filtros" description="Amplía las fechas o quita el filtro de socio o de IVA." />
      )}

      {list.data && list.data.total > 0 && (
        <nav aria-label="Paginación de ventas" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-small text-muted">
          <span>
            {list.data.total} venta(s) · página {list.data.pagina} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={pagina <= 1 || list.isFetching} onClick={() => setPagina((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pagina >= totalPages || list.isFetching} onClick={() => setPagina((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </nav>
      )}
    </section>
  );
};
