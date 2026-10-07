import React, { useState } from 'react';
import { useAdminOrdenes, type AdminOrdenView, type AdminOrdersFilters } from '../../api/endpoints/admin';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { TicketQr } from '../../components/common/TicketQr';
import { fareFamilyLabel, formatDateTime, orderStatusLabel, orderStatusTone, passengerTypeLabel } from '../../lib/labels';
import { useSession } from '../../lib/session';

interface HistoryEntry {
  estado: string;
  en: string;
  motivo?: string;
}

const STATUSES = ['EMITIDA', 'PAGADA', 'PENDIENTE_PAGO', 'FALLIDA_COMPENSADA', 'EXPIRADA', 'COMPLETADA', 'REEMBOLSADA'];

export const AdminOrdersPage: React.FC = () => {
  const session = useSession();
  const [draft, setDraft] = useState<AdminOrdersFilters>({});
  const [filters, setFilters] = useState<AdminOrdersFilters>({});
  const [selected, setSelected] = useState<AdminOrdenView | null>(null);

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminOrdenes(filters, session?.ownerId);
  const orders = data?.pages.flatMap((page) => page.items) ?? [];

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters(Object.fromEntries(Object.entries(draft).filter(([, value]) => value)) as AdminOrdersFilters);
  };

  const clear = () => {
    setDraft({});
    setFilters({});
  };

  return (
    <section aria-label="Órdenes">
      <form onSubmit={apply} className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
        <Select label="Estado" value={draft.estado ?? ''} onChange={(e) => setDraft({ ...draft, estado: e.target.value })}>
          <option value="">Todos</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {orderStatusLabel(status)}
            </option>
          ))}
        </Select>
        <Input label="N.º de orden" placeholder="ORD-…" value={draft.numero ?? ''} onChange={(e) => setDraft({ ...draft, numero: e.target.value })} />
        <Input label="Código de reserva" placeholder="ABC123" maxLength={6} value={draft.pnr ?? ''} onChange={(e) => setDraft({ ...draft, pnr: e.target.value })} />
        <Input label="Desde" type="date" value={draft.desde ?? ''} onChange={(e) => setDraft({ ...draft, desde: e.target.value })} />
        <Input label="Hasta" type="date" value={draft.hasta ?? ''} onChange={(e) => setDraft({ ...draft, hasta: e.target.value })} />
        <div className="flex items-end gap-2">
          <Button type="submit" variant="primary" className="flex-1">
            Filtrar
          </Button>
          <Button type="button" variant="outline" onClick={clear}>
            Limpiar
          </Button>
        </div>
      </form>

      {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-4" />}

      <div role="region" tabIndex={0} aria-label="Tabla de órdenes, desplazable horizontalmente" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Órdenes de compra</caption>
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Orden</th>
              <th scope="col" className="px-4 py-3">Reserva</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3">Comprador</th>
              <th scope="col" className="px-4 py-3">Fecha</th>
              <th scope="col" className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="p-4">
                  <Skeleton className="h-24 w-full" />
                </td>
              </tr>
            )}
            {orders.map((orden) => (
              <tr key={orden.ordenId} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(orden)}>
                <td className="px-4 py-3 font-mono text-xs font-bold text-brand-black">
                  <button type="button" className="underline-offset-2 hover:underline" onClick={() => setSelected(orden)}>
                    {orden.numeroOrden}
                  </button>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{orden.pnr ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${orderStatusTone(orden.estado)}`}>{orderStatusLabel(orden.estado)}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{orden.comprador === 'cliente' ? 'Cliente' : 'Invitado'}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(orden.creadaEn)}</td>
                <td className="px-4 py-3 text-right">
                  <MoneyText amount={orden.total.monto} currency={orden.total.moneda} />
                </td>
              </tr>
            ))}
            {!isLoading && orders.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  No hay órdenes con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasNextPage && (
        <div className="pt-5 text-center">
          <Button variant="outline" onClick={() => fetchNextPage()} isLoading={isFetchingNextPage}>
            Cargar más
          </Button>
        </div>
      )}

      <Dialog isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `Orden ${selected.numeroOrden}` : ''} maxWidth="2xl">
        {selected && (
          <div className="space-y-5 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Estado</dt>
                <dd className="mt-1 font-semibold">{orderStatusLabel(selected.estado)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Código de reserva</dt>
                <dd className="mt-1 font-mono font-semibold">{selected.pnr ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Contacto</dt>
                <dd className="mt-1">
                  {selected.contacto?.correo}
                  <br />
                  {selected.contacto?.telefono}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Pago</dt>
                <dd className="mt-1">
                  {selected.pago.marca} •••• {selected.pago.ultimos4 ?? '----'} · {selected.pago.cuotas} cuota(s)
                </dd>
              </div>
            </dl>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Itinerario</h3>
              <ul className="space-y-1.5">
                {selected.itinerarios.map((itin, index) => (
                  <li key={index} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-bold">
                      {itin.numeroVuelo} · {itin.origen} → {itin.destino}
                    </span>
                    <span>
                      {formatDateTime(itin.salida)} UTC · {fareFamilyLabel(itin.familia)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Pasajeros</h3>
              <ul className="space-y-2">
                {selected.pasajeros.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs">
                    <div className="space-y-1">
                      <div className="font-bold">
                        {p.nombres} {p.apellidos} ({passengerTypeLabel(p.tipo)})
                      </div>
                      <div className="font-mono text-slate-600">Billete: {p.eTicket ?? 'sin billete'}</div>
                      {p.asientos && p.asientos.length > 0 && (
                        <div className="text-slate-600">
                          Asiento{p.asientos.length > 1 ? 's' : ''}: <span className="font-mono font-semibold">{p.asientos.map((a) => `${a.numeroVuelo} · ${a.asiento}`).join('   ')}</span>
                        </div>
                      )}
                      {p.qr && (
                        <div className="break-all font-mono text-[10px] text-slate-400" title="Texto firmado del código QR">
                          {p.qr}
                        </div>
                      )}
                    </div>
                    {p.qr && <TicketQr code={p.qr} size={88} passengerName={`${p.nombres} ${p.apellidos}`} />}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Historial</h3>
              <ol className="space-y-1 text-xs text-slate-600">
                {(selected.historial as unknown as HistoryEntry[]).map((h, index) => (
                  <li key={index}>
                    {formatDateTime(h.en)} UTC · <strong>{orderStatusLabel(h.estado)}</strong>
                    {h.motivo ? ` · ${h.motivo}` : ''}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
};
