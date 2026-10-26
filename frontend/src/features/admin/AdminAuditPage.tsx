import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ClipboardList, Search, X } from 'lucide-react';
import { AUDIT_LIMIT, useAuditoriaSagas, useAuditoriaTransacciones } from '../../api/endpoints/auditoria';
import type { AuditoriaSaga } from '../../api/types';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { AUDIT_BADGE_CLASS, SAGA_STATES, cleanCorrelation, formatDuration, pasoEstado, pasosOrdenados, sagaDuration, sagaEstado, sagaRequiereAtencion } from '../../lib/auditoria';
import { formatDateTime } from '../../lib/labels';
import { useSession } from '../../lib/session';

/** A correlation id that opens the audit filtered by it: everything that request touched. */
const CorrelationLink: React.FC<{ id: string }> = ({ id }) => (
  <Link
    to={`/admin/auditoria?correlationId=${encodeURIComponent(id)}`}
    className="break-all font-mono text-[11px] font-semibold text-brand-blue underline underline-offset-2 hover:text-brand-black"
    aria-label={`Ver todo lo que tocó la correlación ${id}`}
    title="Ver todo lo que tocó esta correlación"
  >
    {id}
  </Link>
);

const Pill: React.FC<{ tone: keyof typeof AUDIT_BADGE_CLASS; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${AUDIT_BADGE_CLASS[tone]}`}>{children}</span>
);

const SagaCard: React.FC<{ saga: AuditoriaSaga }> = ({ saga }) => {
  const estado = sagaEstado(saga.estado);
  const attention = sagaRequiereAtencion(saga.estado);
  const total = sagaDuration(saga);
  const pasos = pasosOrdenados(saga);
  const titleId = `saga-${saga.sagaId}`;

  return (
    <li className={`rounded-2xl border bg-white p-4 shadow-sm ${attention ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'}`}>
      <article aria-labelledby={titleId}>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 id={titleId} className="flex flex-wrap items-center gap-2 text-sm font-black text-brand-black">
              {attention && <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />}
              {saga.tipo}
            </h4>
            <p className="mt-0.5 break-all font-mono text-[11px] text-slate-500">Referencia: {saga.referencia}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Correlación: <CorrelationLink id={saga.correlationId} />
            </p>
          </div>
          <div className="text-right">
            <Pill tone={estado.tone}>{estado.label}</Pill>
            <p className="mt-1 text-[11px] text-slate-500">
              {formatDateTime(saga.iniciadaEn)} UTC{total !== null ? ` · ${formatDuration(total)}` : saga.finalizadaEn ? '' : ' · sin finalizar'}
            </p>
          </div>
        </header>

        {attention && (
          <p role="note" className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {saga.estado === 'COMPENSADA' ? 'La saga falló y se deshicieron sus pasos (compensación).' : 'La saga falló.'}
              {saga.error ? ` Motivo: ${saga.error}` : ''}
            </span>
          </p>
        )}

        <details className="mt-3" open={attention}>
          <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-brand-black">
            {pasos.length} paso(s)
          </summary>
          <div role="region" tabIndex={0} aria-label={`Pasos de la saga ${saga.tipo}, desplazable horizontalmente`} className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <caption className="sr-only">Pasos de la saga {saga.tipo} en orden de ejecución</caption>
              <thead className="text-slate-500">
                <tr>
                  <th scope="col" className="py-1 pr-3 font-semibold">#</th>
                  <th scope="col" className="py-1 pr-3 font-semibold">Paso</th>
                  <th scope="col" className="py-1 pr-3 font-semibold">Estado</th>
                  <th scope="col" className="py-1 pr-3 text-right font-semibold">Duración</th>
                  <th scope="col" className="py-1 font-semibold">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pasos.map((paso) => {
                  const e = pasoEstado(paso.estado);
                  return (
                    <tr key={paso.secuencia} className={e.tone === 'danger' ? 'bg-red-50/60' : ''}>
                      <td className="py-1.5 pr-3 font-mono text-slate-500">{paso.secuencia}</td>
                      <td className="py-1.5 pr-3 font-semibold text-slate-900">{paso.nombre}</td>
                      <td className="py-1.5 pr-3">
                        <Pill tone={e.tone}>{e.label}</Pill>
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono">{formatDuration(paso.duracionMs)}</td>
                      <td className="py-1.5 text-slate-600">{paso.detalle ?? '—'}</td>
                    </tr>
                  );
                })}
                {pasos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-slate-500">
                      Sin pasos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </details>
      </article>
    </li>
  );
};

/** ADMIN only: audit trail by GraphQL: the events recorded and the sagas with their steps. */
export const AdminAuditPage: React.FC = () => {
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const applied = cleanCorrelation(params.get('correlationId') ?? '');
  const [draft, setDraft] = useState(applied ?? '');
  const [tipoTx, setTipoTx] = useState('');
  const [estadoSaga, setEstadoSaga] = useState('');

  // When the link changes the applied filter (a click on a correlation id), the box follows it.
  const [seen, setSeen] = useState(applied);
  if (seen !== applied) {
    setSeen(applied);
    setDraft(applied ?? '');
  }

  const tx = useAuditoriaTransacciones({ correlationId: applied, tipo: tipoTx.trim() || undefined }, session?.ownerId);
  const sagas = useAuditoriaSagas({ correlationId: applied, estado: estadoSaga || undefined }, session?.ownerId);

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const next = cleanCorrelation(draft);
    setParams(next ? { correlationId: next } : {});
  };

  const clear = () => {
    setDraft('');
    setTipoTx('');
    setEstadoSaga('');
    setParams({});
  };

  const eventos = tx.data ?? [];
  const lista = sagas.data ?? [];
  const sagasProblema = lista.filter((s) => sagaRequiereAtencion(s.estado)).length;

  return (
    <section aria-label="Auditoría">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-brand-gold-dark" aria-hidden="true" />
        <h2 className="text-lg font-black text-brand-black">Auditoría</h2>
      </div>

      <form onSubmit={apply} className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[2fr_1fr_1fr_auto]" aria-label="Filtros de auditoría">
        <Input label="Correlation id" placeholder="Pega el id de una solicitud" value={draft} onChange={(e) => setDraft(e.target.value)} leftIcon={<Search className="h-4 w-4" />} helperText="Muestra todo lo que tocó esa solicitud, en eventos y sagas." />
        <Input label="Tipo de evento" placeholder="order.issued" value={tipoTx} onChange={(e) => setTipoTx(e.target.value)} />
        <Select
          label="Estado de la saga"
          value={estadoSaga}
          onChange={(e) => setEstadoSaga(e.target.value)}
          options={[{ value: '', label: 'Todos' }, ...SAGA_STATES.map((s) => ({ value: s, label: sagaEstado(s).label }))]}
        />
        <div className="flex items-end gap-2">
          <Button type="submit" variant="primary">
            Buscar
          </Button>
          <Button type="button" variant="outline" onClick={clear}>
            Limpiar
          </Button>
        </div>
      </form>

      {applied && (
        <p role="status" className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-gold/40 bg-brand-gold-light px-3 py-1.5 text-xs font-semibold text-brand-black">
          Filtrando por la correlación <span className="font-mono">{applied}</span>
          <button type="button" onClick={clear} className="rounded-full p-0.5 hover:bg-white" aria-label="Quitar el filtro de correlación">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </p>
      )}

      <section aria-labelledby="audit-tx" className="mb-8">
        <h3 id="audit-tx" className="mb-2 text-sm font-black text-brand-black">
          Transacciones <span className="font-normal text-slate-500">(eventos registrados, hasta {AUDIT_LIMIT})</span>
        </h3>
        {tx.error != null && <ProblemAlert error={tx.error} onRetry={() => tx.refetch()} className="mb-3" />}
        <div role="region" tabIndex={0} aria-label="Tabla de transacciones, desplazable horizontalmente" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] text-left text-sm" aria-busy={tx.isFetching}>
            <caption className="sr-only">Eventos de dominio registrados, los más recientes primero</caption>
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Cuándo (UTC)</th>
                <th scope="col" className="px-4 py-3">Evento</th>
                <th scope="col" className="px-4 py-3">Resumen</th>
                <th scope="col" className="px-4 py-3">Agregado</th>
                <th scope="col" className="px-4 py-3">Correlación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tx.isLoading && (
                <tr>
                  <td colSpan={5} className="p-4">
                    <div role="status" aria-busy="true" aria-label="Cargando">
                      <Skeleton className="h-20 w-full" />
                    </div>
                  </td>
                </tr>
              )}
              {eventos.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatDateTime(e.ocurridoEn)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-brand-black">{e.tipo}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{e.resumen}</td>
                  <td className="px-4 py-3 break-all font-mono text-[11px] text-slate-500">{e.agregadoId}</td>
                  <td className="px-4 py-3">
                    <CorrelationLink id={e.correlationId} />
                  </td>
                </tr>
              ))}
              {!tx.isLoading && eventos.length === 0 && !tx.error && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    No hay eventos con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="audit-sagas">
        <h3 id="audit-sagas" className="mb-2 flex flex-wrap items-center gap-2 text-sm font-black text-brand-black">
          Sagas <span className="font-normal text-slate-500">(procesos de varios pasos, hasta {AUDIT_LIMIT})</span>
          {sagasProblema > 0 && (
            <Pill tone="danger">
              {sagasProblema} con compensación o fallo
            </Pill>
          )}
        </h3>
        {sagas.error != null && <ProblemAlert error={sagas.error} onRetry={() => sagas.refetch()} className="mb-3" />}
        {sagas.isLoading ? (
          <div role="status" aria-busy="true" aria-label="Cargando">
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : (
          <ul className="space-y-3" aria-busy={sagas.isFetching}>
            {lista.map((s) => (
              <SagaCard key={s.sagaId} saga={s} />
            ))}
            {lista.length === 0 && !sagas.error && (
              <li className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No hay sagas con estos filtros.</li>
            )}
          </ul>
        )}
      </section>
    </section>
  );
};
