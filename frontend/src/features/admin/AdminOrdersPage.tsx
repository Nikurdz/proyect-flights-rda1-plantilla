import React, { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { useAdminOrdenes, type AdminOrdenView, type AdminOrdersFilters } from '../../api/endpoints/admin';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../../components/ui/Table';
import { AdminPageHeader } from './AdminPageHeader';
import { FilterPanel } from './FilterPanel';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { TicketQr } from '../../components/common/TicketQr';
import { fareFamilyLabel, formatAdminDateTime, orderStatusLabel, orderStatusTone, passengerTypeLabel } from '../../lib/labels';
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
      <AdminPageHeader page="ordenes" description="Todas las compras de la web y de los socios. Abre una orden para ver pasajeros, billetes y su historial." />
      <FilterPanel activeCount={Object.keys(filters).length}>
        <form onSubmit={apply} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Select label="Estado" value={draft.estado ?? ''} onChange={(e) => setDraft({ ...draft, estado: e.target.value })}>
            <option value="">Todos</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {orderStatusLabel(status)}
              </option>
            ))}
          </Select>
          <Input label="N.º de orden" placeholder="Ej. ORD-2026-0001" value={draft.numero ?? ''} onChange={(e) => setDraft({ ...draft, numero: e.target.value })} />
          <Input label="Código de reserva" placeholder="Ej. ABC123" maxLength={6} value={draft.pnr ?? ''} onChange={(e) => setDraft({ ...draft, pnr: e.target.value })} />
          <Input label="Desde (hora de Ecuador)" type="date" value={draft.desde ?? ''} onChange={(e) => setDraft({ ...draft, desde: e.target.value })} />
          <Input label="Hasta (hora de Ecuador)" type="date" value={draft.hasta ?? ''} onChange={(e) => setDraft({ ...draft, hasta: e.target.value })} />
          <div className="flex items-end gap-2">
            <Button type="submit" variant="primary" className="flex-1">
              Filtrar
            </Button>
            <Button type="button" variant="outline" onClick={clear}>
              Limpiar
            </Button>
          </div>
        </form>
      </FilterPanel>

      {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-4" />}

      <Table label="Órdenes de compra" className="min-w-[720px]">
        <TableHead>
          <tr>
            <TableHeaderCell>Orden</TableHeaderCell>
            <TableHeaderCell>Reserva</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>Comprador</TableHeaderCell>
            <TableHeaderCell>Fecha (hora de Ecuador)</TableHeaderCell>
            <TableHeaderCell className="text-right">Total</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {isLoading && (
            <tr>
              <td colSpan={6} className="p-4">
                <div role="status" aria-busy="true" aria-label="Cargando">
                  <Skeleton className="h-24 w-full" />
                </div>
              </td>
            </tr>
          )}
          {orders.map((orden) => (
            <TableRow key={orden.ordenId} className="cursor-pointer" onClick={() => setSelected(orden)}>
              <TableCell className="num font-semibold text-ink">
                <button type="button" className="rounded underline-offset-2 hover:underline" onClick={() => setSelected(orden)}>
                  {orden.numeroOrden}
                </button>
              </TableCell>
              <TableCell className="num">{orden.pnr ?? '—'}</TableCell>
              <TableCell>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusTone(orden.estado)}`}>{orderStatusLabel(orden.estado)}</span>
              </TableCell>
              <TableCell className="text-muted">{orden.comprador === 'cliente' ? 'Cliente' : 'Invitado'}</TableCell>
              <TableCell className="num text-muted">{formatAdminDateTime(orden.creadaEn)}</TableCell>
              <TableCell className="text-right">
                <MoneyText amount={orden.total.monto} currency={orden.total.moneda} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!isLoading && orders.length === 0 && !error && (
        <EmptyState icon={<ReceiptText />} title="No hay órdenes con estos filtros" description="Prueba con otro estado o amplía el rango de fechas." />
      )}

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
                <dt className="text-small font-medium text-muted">Estado</dt>
                <dd className="mt-1 font-semibold">{orderStatusLabel(selected.estado)}</dd>
              </div>
              <div>
                <dt className="text-small font-medium text-muted">Código de reserva</dt>
                <dd className="num mt-1 font-semibold">{selected.pnr ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-small font-medium text-muted">Contacto</dt>
                <dd className="mt-1">
                  {selected.contacto?.correo}
                  <br />
                  {selected.contacto?.telefono}
                </dd>
              </div>
              <div>
                <dt className="text-small font-medium text-muted">Pago</dt>
                <dd className="mt-1">
                  {selected.pago.marca} •••• {selected.pago.ultimos4 ?? '----'} · {selected.pago.cuotas} cuota(s)
                </dd>
              </div>
            </dl>

            <div>
              <h3 className="mb-2 text-small font-semibold text-ink">Itinerario</h3>
              <ul className="space-y-1.5">
                {selected.itinerarios.map((itin, index) => (
                  <li key={index} className="flex flex-wrap justify-between gap-2 rounded-lg bg-paper px-3 py-2 text-xs">
                    <span className="font-bold">
                      {itin.numeroVuelo} · {itin.origen} → {itin.destino}
                    </span>
                    <span>
                      {formatAdminDateTime(itin.salida)} · {fareFamilyLabel(itin.familia)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-small font-semibold text-ink">Pasajeros</h3>
              <ul className="space-y-2">
                {selected.pasajeros.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2.5 text-xs">
                    <div className="space-y-1">
                      <div className="font-bold">
                        {p.nombres} {p.apellidos} ({passengerTypeLabel(p.tipo)})
                      </div>
                      <div className="num text-muted">Billete: {p.eTicket ?? 'sin billete'}</div>
                      {p.asientos && p.asientos.length > 0 && (
                        <div className="text-muted">
                          Asiento{p.asientos.length > 1 ? 's' : ''}: <span className="num font-semibold">{p.asientos.map((a) => `${a.numeroVuelo} · ${a.asiento}`).join('   ')}</span>
                        </div>
                      )}
                    </div>
                    {p.qr && <TicketQr code={p.qr} size={88} passengerName={`${p.nombres} ${p.apellidos}`} />}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-small font-semibold text-ink">Historial</h3>
              <ol className="space-y-1 text-xs text-muted">
                {(selected.historial as unknown as HistoryEntry[]).map((h, index) => (
                  <li key={index}>
                    {formatAdminDateTime(h.en)} · <strong>{orderStatusLabel(h.estado)}</strong>
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
