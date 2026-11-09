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
import { useSession } from '../../lib/session';
import { adminErrorMessage } from './admin-errors';
import { BillingTabs } from './BillingTabs';
import { BOOKING_STATUS_LABEL } from './reservas';

interface Form {
  desde: string;
  hasta: string;
  partnerId: string;
  estado: ConciliacionFiltros['estado'];
  soloAlertas: boolean;
}

const initialForm = (): Form => ({ ...currentMonthRange(), partnerId: '', estado: '', soloAlertas: false });

const Card: React.FC<{ label: string; children: React.ReactNode; tone?: string }> = ({ label, children, tone = 'bg-white text-brand-black' }) => (
  <div className={`rounded-xl border border-slate-200 p-3 shadow-sm ${tone}`}>
    <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">{label}</div>
    <div className="mt-1 text-lg font-black">{children}</div>
  </div>
);

const money = (amount: string | null, currency: string) => (amount == null ? '—' : <MoneyText amount={amount} currency={currency} size="sm" />);

const IvaAlerta: React.FC<{ item: ConciliacionItem }> = ({ item }) => (
  <div role="alert" className="mt-1 rounded-lg border border-amber-300 bg-amber-50 p-1.5 text-[11px] text-amber-900">
    <span className="inline-flex items-center gap-1 font-bold">
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
  const [exported, setExported] = useState<string | null>(null);

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
    setExported(null);
    exportCsv.mutate(filters, { onSuccess: (filename) => setExported(filename) });
  };

  return (
    <section aria-label="Facturación de Booking">
      <div className="mb-4 flex items-center gap-2">
        <Receipt className="h-5 w-5 text-brand-gold-dark" aria-hidden="true" />
        <h2 className="text-lg font-black text-brand-black">Facturación</h2>
      </div>
      <BillingTabs />

      <p role="note" className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
        Vista de conciliación: no es un documento fiscal. Las facturas las emite Booking (IVA 15 % incluido); aquí se comparan sus importes con los nuestros.
      </p>

      <form onSubmit={apply} className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Desde (Ecuador)" type="date" value={draft.desde} max={draft.hasta || undefined} onChange={(e) => set('desde', e.target.value)} />
        <Input label="Hasta (Ecuador)" type="date" value={draft.hasta} min={draft.desde || undefined} onChange={(e) => set('hasta', e.target.value)} />
        <Input label="Socio" placeholder="booking-prototipo" maxLength={60} value={draft.partnerId} onChange={(e) => set('partnerId', e.target.value)} />
        <Select label="Estado" value={draft.estado ?? ''} onChange={(e) => set('estado', e.target.value as Form['estado'])}>
          <option value="">Todos</option>
          {ESTADOS_RESERVA.map((s) => (
            <option key={s} value={s}>
              {BOOKING_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 self-end text-sm font-semibold text-slate-700">
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

      {resumen?.truncado && (
        <p role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
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
            <Card label="Neto" tone="bg-brand-black text-brand-gold">
              {money(t.neto, moneda)}
            </Card>
            <Card label="Alertas de IVA" tone={t.alertasIva > 0 ? 'bg-amber-50 text-amber-900' : 'bg-white text-brand-black'}>
              {t.alertasIva}
            </Card>
          </>
        )}
      </div>

      {resumen && resumen.dias.length > 0 && (
        <div role="region" tabIndex={0} aria-label="Resumen por día, desplazable horizontalmente" className="mb-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-xs">
            <caption className="sr-only">Resumen por día de Ecuador</caption>
            <thead className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2">Día</th>
                <th scope="col" className="px-4 py-2">Ventas</th>
                <th scope="col" className="px-4 py-2">Base</th>
                <th scope="col" className="px-4 py-2">IVA</th>
                <th scope="col" className="px-4 py-2">Total</th>
                <th scope="col" className="px-4 py-2">Cancelaciones</th>
                <th scope="col" className="px-4 py-2">Reembolsos</th>
                <th scope="col" className="px-4 py-2">Neto</th>
                <th scope="col" className="px-4 py-2">Alertas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resumen.dias.map((d) => (
                <tr key={d.fecha}>
                  <td className="px-4 py-2 font-mono font-semibold">{d.fecha}</td>
                  <td className="px-4 py-2">{d.ventas}</td>
                  <td className="px-4 py-2">{money(d.base, moneda)}</td>
                  <td className="px-4 py-2">{money(d.iva, moneda)}</td>
                  <td className="px-4 py-2">{money(d.total, moneda)}</td>
                  <td className="px-4 py-2">{d.cancelaciones}</td>
                  <td className="px-4 py-2">{money(d.reembolsos, moneda)}</td>
                  <td className="px-4 py-2 font-bold">{money(d.neto, moneda)}</td>
                  <td className="px-4 py-2">{d.alertasIva > 0 ? <span className="font-bold text-amber-800">{d.alertasIva}</span> : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="text-[11px] text-slate-500">El CSV usa los filtros aplicados (sin paginar, hasta 5000 ventas, las más antiguas primero).</p>
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
      {exportCsv.error != null && <ProblemAlert error={exportCsv.error} message={adminErrorMessage(exportCsv.error, 'exportar-conciliacion')} className="mb-4" />}
      {list.error != null && <ProblemAlert error={list.error} onRetry={() => list.refetch()} className="mb-4" />}

      <div role="region" tabIndex={0} aria-label="Tabla de ventas de Booking, desplazable horizontalmente" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm" aria-busy={list.isFetching}>
        <table className="w-full min-w-[1100px] text-left text-sm">
          <caption className="sr-only">Ventas de Booking como líneas de factura</caption>
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Fecha</th>
              <th scope="col" className="px-4 py-3">PNR</th>
              <th scope="col" className="px-4 py-3">Orden del socio</th>
              <th scope="col" className="px-4 py-3">Pago</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3">Base</th>
              <th scope="col" className="px-4 py-3">IVA</th>
              <th scope="col" className="px-4 py-3">IVA según Booking</th>
              <th scope="col" className="px-4 py-3">Total</th>
              <th scope="col" className="px-4 py-3">Nota de crédito</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
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
              <tr key={i.bookingId} className="align-top hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{i.fecha}</td>
                <td className="px-4 py-3 font-mono text-xs font-bold text-brand-black">{i.pnr}</td>
                <td className="break-all px-4 py-3 font-mono text-xs text-slate-600">{i.partnerOrderId ?? '—'}</td>
                <td className="break-all px-4 py-3 font-mono text-xs text-slate-600">{i.paymentReference}</td>
                <td className="px-4 py-3 text-xs">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${i.estado === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {BOOKING_STATUS_LABEL[i.estado as keyof typeof BOOKING_STATUS_LABEL] ?? i.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">{money(i.base, i.moneda)}</td>
                <td className="px-4 py-3 text-xs">
                  {money(i.iva, i.moneda)}
                  {i.ivaAlerta && <IvaAlerta item={i} />}
                </td>
                <td className="px-4 py-3 text-xs">{money(i.ivaSegunBooking, i.moneda)}</td>
                <td className="px-4 py-3 text-xs font-bold">{money(i.total, i.moneda)}</td>
                <td className="px-4 py-3 text-xs">
                  {i.notaCredito ? (
                    <div>
                      <div className="font-mono font-bold text-red-800">{i.notaCredito.numero}</div>
                      <div className="text-slate-600">Reembolso {i.notaCredito.reembolso}</div>
                      <div className="text-slate-600">Penalidad {i.notaCredito.penalidad}</div>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {!list.isLoading && items.length === 0 && !list.error && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500">
                  No hay ventas de Booking con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {list.data && list.data.total > 0 && (
        <nav aria-label="Paginación de ventas" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
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
