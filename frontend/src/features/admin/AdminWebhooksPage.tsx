import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Webhook } from 'lucide-react';
import {
  ESTADOS_ENTREGA,
  WEBHOOKS_REFRESH_MS,
  useAdminWebhookEntregas,
  useAdminWebhookSuscripciones,
  useReintentarEntrega,
  type EstadoEntrega,
  type WebhookEntrega,
  type WebhookEntregasFilters,
  type WebhookSuscripcion,
} from '../../api/endpoints/admin';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatAdminDateTime } from '../../lib/labels';
import { useSession } from '../../lib/session';
import { adminErrorMessage } from './admin-errors';

const ESTADO_LABEL: Record<EstadoEntrega, string> = { PENDING: 'Pendiente', DELIVERED: 'Entregada', DEAD: 'Muerta' };
const ESTADO_TONE: Record<EstadoEntrega, string> = {
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  PENDING: 'bg-amber-100 text-amber-800',
  DEAD: 'bg-red-100 text-red-800',
};

const isEstado = (value: string | null): value is EstadoEntrega => (ESTADOS_ENTREGA as readonly string[]).includes(value ?? '');

const EstadoBadge: React.FC<{ estado: EstadoEntrega }> = ({ estado }) => (
  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ESTADO_TONE[estado]}`}>{ESTADO_LABEL[estado]}</span>
);

const fecha = (iso: string | null): string => (iso ? `${formatAdminDateTime(iso)}` : '—');

interface FiltrosForm {
  estado: EstadoEntrega | '';
  tipo: string;
  owner: string;
}

const SubscriptionsTable: React.FC<{ items: WebhookSuscripcion[]; onPick: (s: WebhookSuscripcion) => void; selectedId?: string }> = ({ items, onPick, selectedId }) => (
  <div role="region" tabIndex={0} aria-label="Tabla de suscripciones, desplazable horizontalmente" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
    <table className="w-full min-w-[900px] text-left text-sm">
      <caption className="sr-only">Suscripciones de webhooks</caption>
      <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
        <tr>
          <th scope="col" className="px-4 py-3">Dueño</th>
          <th scope="col" className="px-4 py-3">URL</th>
          <th scope="col" className="px-4 py-3">Versión</th>
          <th scope="col" className="px-4 py-3">Activa</th>
          <th scope="col" className="px-4 py-3">Eventos</th>
          <th scope="col" className="px-4 py-3">Entregas</th>
          <th scope="col" className="px-4 py-3 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {items.map((s) => (
          <tr key={s.suscripcionId} className={`align-top ${selectedId === s.suscripcionId ? 'bg-amber-50/60' : 'hover:bg-slate-50'}`}>
            <td className="px-4 py-3 text-xs">
              <div className="break-all font-mono font-semibold text-brand-black">{s.owner}</div>
              <div className="mt-1 text-[11px] text-slate-500">Creada {fecha(s.creadaEn)}</div>
            </td>
            <td className="max-w-[18rem] break-all px-4 py-3 font-mono text-xs text-slate-700">{s.url}</td>
            <td className="px-4 py-3 text-xs font-semibold">v{s.apiVersion}</td>
            <td className="px-4 py-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.activa ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{s.activa ? 'Sí' : 'No'}</span>
            </td>
            <td className="px-4 py-3 text-xs">
              <details>
                <summary className="cursor-pointer font-semibold text-slate-700" title={s.eventos.join(', ')}>
                  {s.eventos.length} evento(s)
                </summary>
                <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-slate-600">
                  {s.eventos.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </details>
            </td>
            <td className="px-4 py-3 text-xs">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">{s.entregas.entregadas} entregadas</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">{s.entregas.pendientes} pendientes</span>
                <span className={`rounded-full px-2 py-0.5 font-bold ${s.entregas.muertas > 0 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}`}>{s.entregas.muertas} muertas</span>
              </div>
            </td>
            <td className="px-4 py-3 text-right">
              <Button type="button" size="sm" variant="outline" aria-label={`Ver las entregas de ${s.owner}`} onClick={() => onPick(s)}>
                Ver entregas
              </Button>
            </td>
          </tr>
        ))}
        {items.length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
              No hay suscripciones de webhooks registradas.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const DeliveryRow: React.FC<{ d: WebhookEntrega; busy: boolean; onRetry: (d: WebhookEntrega) => void }> = ({ d, busy, onRetry }) => (
  <tr className="align-top hover:bg-slate-50">
    <td className="px-4 py-3 text-xs text-slate-700">{fecha(d.creadaEn)}</td>
    <td className="px-4 py-3 text-xs">
      <div className="font-mono font-semibold text-brand-black">{d.tipo}</div>
      <div className="break-all font-mono text-[11px] text-slate-500" title={d.url ?? undefined}>
        {d.owner ?? '—'}
      </div>
    </td>
    <td className="px-4 py-3 text-xs">
      <div className="font-mono font-bold">{d.pnr ?? '—'}</div>
      <div className="break-all font-mono text-[11px] text-slate-600">{d.partnerOrderId ?? '—'}</div>
    </td>
    <td className="px-4 py-3">
      <EstadoBadge estado={d.estado} />
      {d.entregadaEn && <div className="mt-1 text-[11px] text-slate-500">{fecha(d.entregadaEn)}</div>}
    </td>
    <td className="px-4 py-3 text-center font-mono text-xs">{d.intentos}</td>
    <td className="max-w-[16rem] px-4 py-3 text-xs">
      {d.ultimoCodigo != null && <span className={`font-mono font-bold ${d.ultimoCodigo >= 200 && d.ultimoCodigo < 300 ? 'text-emerald-700' : 'text-red-700'}`}>HTTP {d.ultimoCodigo}</span>}
      {d.ultimoError && (
        <div className="break-words text-[11px] text-red-700" title={d.ultimoError}>
          {d.ultimoError.length > 120 ? `${d.ultimoError.slice(0, 120)}…` : d.ultimoError}
        </div>
      )}
      {d.ultimoCodigo == null && !d.ultimoError && <span className="text-slate-400">—</span>}
    </td>
    <td className="px-4 py-3 text-xs text-slate-700">{fecha(d.proximoIntento)}</td>
    <td className="px-4 py-3 text-right">
      {(d.estado === 'DEAD' || d.estado === 'PENDING') && (
        <Button type="button" size="sm" variant={d.estado === 'DEAD' ? 'danger' : 'outline'} disabled={busy} aria-label={`Reintentar la entrega ${d.tipo} ${d.pnr ?? d.deliveryId}`} onClick={() => onRetry(d)}>
          Reintentar
        </Button>
      )}
    </td>
  </tr>
);

/** ADMIN only: what reached each webhook receiver (Booking among them), with retries of dead deliveries. */
export const AdminWebhooksPage: React.FC = () => {
  const session = useSession();
  const [searchParams] = useSearchParams();
  const initialEstado = searchParams.get('estado');
  const initial: FiltrosForm = { estado: isEstado(initialEstado) ? initialEstado : '', tipo: searchParams.get('tipo') ?? '', owner: searchParams.get('owner') ?? '' };

  const [draft, setDraft] = useState<FiltrosForm>(initial);
  const [filters, setFilters] = useState<WebhookEntregasFilters>(() => toFilters(initial));
  const [suscripcion, setSuscripcion] = useState<WebhookSuscripcion | null>(null);
  const [pagina, setPagina] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  const subs = useAdminWebhookSuscripciones(session?.ownerId);
  const entregas = useAdminWebhookEntregas({ ...filters, suscripcionId: suscripcion?.suscripcionId, pagina }, session?.ownerId);
  const retry = useReintentarEntrega();

  const data = entregas.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limite)) : 1;

  const set = <K extends keyof FiltrosForm>(key: K, value: FiltrosForm[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters(toFilters(draft));
    setPagina(1);
  };

  const clear = () => {
    const empty: FiltrosForm = { estado: '', tipo: '', owner: '' };
    setDraft(empty);
    setFilters({});
    setSuscripcion(null);
    setPagina(1);
  };

  const refresh = () => {
    void subs.refetch();
    void entregas.refetch();
  };

  const doRetry = (d: WebhookEntrega) => {
    retry.reset();
    setNotice(null);
    retry.mutate(d.deliveryId, { onSuccess: (r) => setNotice(`${d.tipo}${d.pnr ? ` (${d.pnr})` : ''}: ${r.mensaje}`) });
  };

  return (
    <section aria-label="Webhooks" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-brand-gold-dark" aria-hidden="true" />
          <h2 className="text-lg font-black text-brand-black">Webhooks</h2>
        </div>
        <button type="button" onClick={refresh} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-black">
          <RefreshCw className={`h-3.5 w-3.5 ${entregas.isFetching || subs.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          {entregas.dataUpdatedAt ? `Actualizar · ${new Date(entregas.dataUpdatedAt).toLocaleTimeString('es-EC')}` : 'Actualizar'}
        </button>
      </div>
      <p className="text-xs text-slate-600">
        Suscripciones de todos los dueños y cada evento enviado a cada una. El despachador envía cada {WEBHOOKS_REFRESH_MS / 1000} s y reintenta a 1 min, 5 min, 30 min, 2 h y 6 h; después la entrega queda muerta. Esta página se actualiza sola con el mismo ritmo. Las horas se muestran en hora de Ecuador (UTC-5).
      </p>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Suscripciones</h3>
        {subs.error != null ? (
          <ProblemAlert error={subs.error} onRetry={() => subs.refetch()} />
        ) : !subs.data ? (
          <div role="status" aria-busy="true" aria-label="Cargando">
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : (
          <SubscriptionsTable
            items={subs.data.items}
            selectedId={suscripcion?.suscripcionId}
            onPick={(s) => {
              setSuscripcion(s);
              setPagina(1);
            }}
          />
        )}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Entregas (más recientes primero)</h3>
        <form onSubmit={apply} className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Estado" value={draft.estado} onChange={(e) => set('estado', e.target.value as FiltrosForm['estado'])}>
            <option value="">Todos</option>
            {ESTADOS_ENTREGA.map((e) => (
              <option key={e} value={e}>
                {ESTADO_LABEL[e]}
              </option>
            ))}
          </Select>
          <Input label="Tipo de evento" placeholder="booking.cancelled" maxLength={40} value={draft.tipo} onChange={(e) => set('tipo', e.target.value)} />
          <Input label="Dueño" placeholder="partner:booking-prototipo" maxLength={100} value={draft.owner} onChange={(e) => set('owner', e.target.value)} />
          <div className="flex items-end gap-2">
            <Button type="submit" variant="primary" className="flex-1">
              Filtrar
            </Button>
            <Button type="button" variant="outline" onClick={clear}>
              Limpiar
            </Button>
          </div>
        </form>

        {suscripcion && (
          <p role="status" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            Solo las entregas de la suscripción de <span className="font-mono font-semibold">{suscripcion.owner}</span> ({suscripcion.url}).
            <button type="button" className="font-semibold underline" onClick={() => setSuscripcion(null)}>
              Ver todas
            </button>
          </p>
        )}

        <div aria-live="polite" className="space-y-3">
          {notice && (
            <p role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              {notice}
            </p>
          )}
          {retry.error != null && <ProblemAlert error={retry.error} message={adminErrorMessage(retry.error, 'reintentar-webhook')} className="mb-3" />}
        </div>
        {entregas.error != null && <ProblemAlert error={entregas.error} onRetry={() => entregas.refetch()} className="mb-3" />}

        <div role="region" tabIndex={0} aria-label="Tabla de entregas, desplazable horizontalmente" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm" aria-busy={entregas.isFetching}>
          <table className="w-full min-w-[1100px] text-left text-sm">
            <caption className="sr-only">Entregas de webhooks</caption>
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Fecha</th>
                <th scope="col" className="px-4 py-3">Tipo / dueño</th>
                <th scope="col" className="px-4 py-3">PNR / orden socio</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3 text-center">Intentos</th>
                <th scope="col" className="px-4 py-3">Último código / error</th>
                <th scope="col" className="px-4 py-3">Próximo intento</th>
                <th scope="col" className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entregas.isLoading && (
                <tr>
                  <td colSpan={8} className="p-4">
                    <div role="status" aria-busy="true" aria-label="Cargando">
                      <Skeleton className="h-24 w-full" />
                    </div>
                  </td>
                </tr>
              )}
              {data?.items.map((d) => (
                <DeliveryRow key={d.deliveryId} d={d} busy={retry.isPending} onRetry={doRetry} />
              ))}
              {!entregas.isLoading && data && data.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                    No hay entregas con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <nav aria-label="Paginación de entregas" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <span>
              {data.total} entrega(s) · página {data.pagina} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={pagina <= 1 || entregas.isFetching} onClick={() => setPagina((p) => Math.max(1, p - 1))}>
                Anterior
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={pagina >= totalPages || entregas.isFetching} onClick={() => setPagina((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          </nav>
        )}
      </div>
    </section>
  );
};

function toFilters(form: FiltrosForm): WebhookEntregasFilters {
  const filters: WebhookEntregasFilters = {};
  if (form.estado) filters.estado = form.estado;
  if (form.tipo.trim()) filters.tipo = form.tipo.trim();
  if (form.owner.trim()) filters.owner = form.owner.trim();
  return filters;
}
