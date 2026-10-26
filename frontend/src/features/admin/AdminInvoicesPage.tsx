import React, { useState } from 'react';
import { Receipt } from 'lucide-react';
import { useAdminFactura, useAdminFacturas, type FacturasFiltros } from '../../api/endpoints/facturas';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { estadoFacturaLabel, origenFacturaLabel } from '../../lib/auditoria';
import { formatDateTime } from '../../lib/labels';
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
              <dt className="font-bold uppercase tracking-wider text-slate-500">Estado</dt>
              <dd className="mt-1">
                <Badge variant={data.estado === 'EMITIDA' ? 'success' : 'danger'}>{estadoFacturaLabel(data.estado)}</Badge>
              </dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-wider text-slate-500">Origen</dt>
              <dd className="mt-1 font-semibold text-slate-800">{origenFacturaLabel(data.origen)}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-wider text-slate-500">Emitida (UTC)</dt>
              <dd className="mt-1 text-slate-800">{formatDateTime(data.emitidaEn)}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-wider text-slate-500">Referencia</dt>
              <dd className="mt-1 break-all font-mono text-[11px] text-slate-800">{data.referencia}</dd>
            </div>
          </dl>

          <div role="region" tabIndex={0} aria-label="Líneas de la factura, desplazable horizontalmente" className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[560px] text-left text-xs">
              <caption className="sr-only">Líneas de la factura {data.numeroFactura}</caption>
              <thead className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2">#</th>
                  <th scope="col" className="px-3 py-2">Concepto</th>
                  <th scope="col" className="px-3 py-2 text-right">Cant.</th>
                  <th scope="col" className="px-3 py-2 text-right">P. unitario</th>
                  <th scope="col" className="px-3 py-2 text-right">IVA</th>
                  <th scope="col" className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.detalles ?? []).map((d) => (
                  <tr key={d.linea}>
                    <td className="px-3 py-2 font-mono text-slate-500">{d.linea}</td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-slate-900">{d.concepto}</span>
                      <span className="block text-[11px] text-slate-500">{LINE_TYPE[d.tipo] ?? d.tipo}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{d.cantidad}</td>
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
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                      Esta factura no tiene líneas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Subtotal</dt>
              <dd><MoneyText amount={data.subtotal.monto} currency={data.subtotal.moneda} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">IVA</dt>
              <dd><MoneyText amount={data.iva.monto} currency={data.iva.moneda} /></dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1">
              <dt className="font-bold text-slate-900">Total</dt>
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
      <div className="mb-4 flex items-center gap-2">
        <Receipt className="h-5 w-5 text-brand-gold-dark" aria-hidden="true" />
        <h2 className="text-lg font-black text-brand-black">Facturación</h2>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto]">
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
        <div className="rounded-xl bg-brand-black px-5 py-2.5 text-white" aria-live="polite">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Total emitido</div>
          <div className="text-xl font-black text-brand-gold">
            {data ? <MoneyText amount={data.totalEmitido.monto} currency={data.totalEmitido.moneda} size="xl" /> : '—'}
          </div>
        </div>
      </div>

      {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-4" />}

      <div role="region" tabIndex={0} aria-label="Tabla de facturas, desplazable horizontalmente" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm" aria-busy={isFetching}>
          <caption className="sr-only">Facturas, las más recientes primero</caption>
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Factura</th>
              <th scope="col" className="px-4 py-3">Emitida (UTC)</th>
              <th scope="col" className="px-4 py-3">Origen</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3 text-right">Subtotal</th>
              <th scope="col" className="px-4 py-3 text-right">IVA</th>
              <th scope="col" className="px-4 py-3 text-right">Total</th>
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
            {facturas.map((f) => (
              <tr key={f.numeroFactura} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setOpen(f.numeroFactura)} className="font-mono text-xs font-bold text-brand-black underline-offset-2 hover:underline" aria-label={`Ver el detalle de la factura ${f.numeroFactura}`}>
                    {f.numeroFactura}
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(f.emitidaEn)}</td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-700">{origenFacturaLabel(f.origen)}</td>
                <td className="px-4 py-3">
                  <Badge variant={f.estado === 'EMITIDA' ? 'success' : 'danger'}>{estadoFacturaLabel(f.estado)}</Badge>
                </td>
                <td className="px-4 py-3 text-right"><MoneyText amount={f.subtotal.monto} currency={f.subtotal.moneda} size="sm" /></td>
                <td className="px-4 py-3 text-right"><MoneyText amount={f.iva.monto} currency={f.iva.moneda} size="sm" /></td>
                <td className="px-4 py-3 text-right"><MoneyText amount={f.total.monto} currency={f.total.moneda} /></td>
              </tr>
            ))}
            {!isLoading && facturas.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  No hay facturas con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">Se muestran las 50 más recientes. El total emitido suma solo las facturas emitidas de esta lista.</p>

      <InvoiceDialog numero={open} ownerId={session?.ownerId} onClose={() => setOpen(null)} />
    </section>
  );
};
