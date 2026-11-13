import React, { useState } from 'react';
import { Receipt } from 'lucide-react';
import { AdminPageHeader } from './AdminPageHeader';
import { useAdminFactura, useAdminFacturas, type FacturasFiltros } from '../../api/endpoints/facturas';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../../components/ui/Table';
import { estadoFacturaLabel, origenFacturaLabel } from '../../lib/auditoria';
import { formatAdminDateTime } from '../../lib/labels';
import { useSession } from '../../lib/session';

const LINE_TYPE: Record<string, string> = { TARIFA: 'Tarifa', EQUIPAJE: 'Equipaje', EXPERIENCIA: 'Experiencia' };

const InvoiceDialog: React.FC<{ numero: string | null; ownerId?: string; onClose: () => void }> = ({ numero, ownerId, onClose }) => {
  const { data, isLoading, error, refetch } = useAdminFactura(numero ?? undefined, ownerId);
  return (
    <Dialog isOpen={Boolean(numero)} onClose={onClose} title={numero ? `Factura ${numero}` : ''} maxWidth="2xl">
      {error != null ? (
        <ProblemAlert error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div role="status" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <dt className="font-medium text-muted">Estado</dt>
              <dd className="mt-1">
                <Badge variant={data.estado === 'EMITIDA' ? 'success' : 'danger'}>{estadoFacturaLabel(data.estado)}</Badge>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted">Origen</dt>
              <dd className="mt-1 font-semibold text-ink">{origenFacturaLabel(data.origen)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted">Emitida (Ecuador)</dt>
              <dd className="mt-1 text-ink">{formatAdminDateTime(data.emitidaEn)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted">Referencia</dt>
              <dd className="mt-1 break-all num text-[11px] text-ink">{data.referencia}</dd>
            </div>
          </dl>

          <div role="region" tabIndex={0} aria-label="Líneas de la factura, desplazable horizontalmente" className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[560px] text-left text-xs">
              <caption className="sr-only">Líneas de la factura {data.numeroFactura}</caption>
              <thead className="bg-paper font-semibold text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">#</th>
                  <th scope="col" className="px-3 py-2">Concepto</th>
                  <th scope="col" className="px-3 py-2 text-right">Cant.</th>
                  <th scope="col" className="px-3 py-2 text-right">P. unitario</th>
                  <th scope="col" className="px-3 py-2 text-right">IVA</th>
                  <th scope="col" className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(data.detalles ?? []).map((d) => (
                  <tr key={d.linea}>
                    <td className="px-3 py-2 num text-muted">{d.linea}</td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-ink">{d.concepto}</span>
                      <span className="block text-[11px] text-muted">{LINE_TYPE[d.tipo] ?? d.tipo}</span>
                    </td>
                    <td className="px-3 py-2 text-right num">{d.cantidad}</td>
                    <td className="px-3 py-2 text-right">
                      <MoneyText amount={d.precioUnitario.monto} currency={d.precioUnitario.moneda} size="sm" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <MoneyText amount={d.iva.monto} currency={d.iva.moneda} size="sm" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <MoneyText amount={d.total.monto} currency={d.total.moneda} size="sm" />
                    </td>
                  </tr>
                ))}
                {(data.detalles ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted">
                      Esta factura no tiene líneas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd><MoneyText amount={data.subtotal.monto} currency={data.subtotal.moneda} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">IVA</dt>
              <dd><MoneyText amount={data.iva.monto} currency={data.iva.moneda} /></dd>
            </div>
            <div className="flex justify-between border-t border-line pt-1">
              <dt className="font-bold text-ink">Total</dt>
              <dd><MoneyText amount={data.total.monto} currency={data.total.moneda} size="lg" /></dd>
            </div>
          </dl>
        </div>
      )}
    </Dialog>
  );
};

/** ADMIN only: invoices of flights and of experiences, with the total of the issued ones. */
export const AdminInvoicesPage: React.FC = () => {
  const session = useSession();
  const [filtros, setFiltros] = useState<FacturasFiltros>({ estado: '', origen: '' });
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useAdminFacturas(filtros, session?.ownerId);
  const facturas = data?.items ?? [];

  return (
    <section aria-label="Facturación">
      <AdminPageHeader page="facturacion" description="Facturas de vuelos y de experiencias, las más recientes primero." />

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_auto]">
        <Select
          label="Estado"
          value={filtros.estado ?? ''}
          onChange={(e) => setFiltros({ ...filtros, estado: e.target.value as FacturasFiltros['estado'] })}
          options={[
            { value: '', label: 'Todos' },
            { value: 'EMITIDA', label: 'Emitida' },
            { value: 'ANULADA', label: 'Anulada' },
          ]}
        />
        <Select
          label="Origen"
          value={filtros.origen ?? ''}
          onChange={(e) => setFiltros({ ...filtros, origen: e.target.value as FacturasFiltros['origen'] })}
          options={[
            { value: '', label: 'Todos' },
            { value: 'ORDEN', label: 'Vuelo (orden)' },
            { value: 'EXPERIENCIA', label: 'Experiencia' },
          ]}
        />
        <div className="rounded-xl bg-chrome px-5 py-2.5 text-white" aria-live="polite">
          <div className="text-small text-white/70">Total emitido</div>
          <div className="num text-lead font-semibold text-gold">
            {data ? <MoneyText amount={data.totalEmitido.monto} currency={data.totalEmitido.moneda} size="xl" /> : '—'}
          </div>
        </div>
      </div>

      {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-4" />}

      <Table label="Facturas" className="min-w-[820px]" aria-busy={isFetching}>
        <TableHead>
          <tr>
            <TableHeaderCell>Factura</TableHeaderCell>
            <TableHeaderCell>Emitida (hora de Ecuador)</TableHeaderCell>
            <TableHeaderCell>Origen</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell className="text-right">Subtotal</TableHeaderCell>
            <TableHeaderCell className="text-right">IVA</TableHeaderCell>
            <TableHeaderCell className="text-right">Total</TableHeaderCell>
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
          {facturas.map((f) => (
            <TableRow key={f.numeroFactura}>
              <TableCell>
                <button type="button" onClick={() => setOpen(f.numeroFactura)} className="num rounded font-semibold text-ink underline-offset-2 hover:underline" aria-label={`Ver el detalle de la factura ${f.numeroFactura}`}>
                  {f.numeroFactura}
                </button>
              </TableCell>
              <TableCell className="num text-muted">{formatAdminDateTime(f.emitidaEn)}</TableCell>
              <TableCell className="font-medium">{origenFacturaLabel(f.origen)}</TableCell>
              <TableCell>
                <Badge variant={f.estado === 'EMITIDA' ? 'success' : 'danger'}>{estadoFacturaLabel(f.estado)}</Badge>
              </TableCell>
              <TableCell className="text-right"><MoneyText amount={f.subtotal.monto} currency={f.subtotal.moneda} size="sm" /></TableCell>
              <TableCell className="text-right"><MoneyText amount={f.iva.monto} currency={f.iva.moneda} size="sm" /></TableCell>
              <TableCell className="text-right"><MoneyText amount={f.total.monto} currency={f.total.moneda} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!isLoading && facturas.length === 0 && !error && (
        <EmptyState icon={<Receipt />} title="No hay facturas con estos filtros" description="Cambia el estado o el origen." />
      )}
      <p className="mt-3 text-small text-muted">Se muestran las 50 más recientes. El total emitido suma solo las facturas emitidas de esta lista.</p>

      <InvoiceDialog numero={open} ownerId={session?.ownerId} onClose={() => setOpen(null)} />
    </section>
  );
};
