import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Send } from 'lucide-react';
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
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../../components/ui/Table';
import { formatAdminDateTime } from '../../lib/labels';
import { useSession } from '../../lib/session';
import { useToast } from '../../lib/toast';
import { adminErrorMessage } from './admin-errors';
import { AdminPageHeader } from './AdminPageHeader';
import { FilterPanel } from './FilterPanel';

const ESTADO_LABEL: Record<EstadoEntrega, string> = { PENDING: 'Pendiente', DELIVERED: 'Entregada', DEAD: 'Sin entregar' };
const ESTADO_TONE: Record<EstadoEntrega, string> = {
  DELIVERED: 'bg-success-soft text-success',
  PENDING: 'bg-warning-soft text-warning',
  DEAD: 'bg-danger-soft text-danger',
};

const isEstado = (value: string | null): value is EstadoEntrega => (ESTADOS_ENTREGA as readonly string[]).includes(value ?? '');

const EstadoBadge: React.FC<{ estado: EstadoEntrega }> = ({ estado }) => (
  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_TONE[estado]}`}>{ESTADO_LABEL[estado]}</span>
);

const fecha = (iso: string | null): string => (iso ? `${formatAdminDateTime(iso)}` : '—');

interface FiltrosForm {
  estado: EstadoEntrega | '';
  tipo: string;
  owner: string;
}

const SubscriptionsTable: React.FC<{ items: WebhookSuscripcion[]; onPick: (s: WebhookSuscripcion) => void; selectedId?: string }> = ({ items, onPick, selectedId }) => (
  <>
    <Table label="Suscripciones de webhooks" className="min-w-[900px]" maxHeightClass="max-h-[50vh]">
      <TableHead>
        <tr>
          <TableHeaderCell>Dueño</TableHeaderCell>
          <TableHeaderCell>URL</TableHeaderCell>
          <TableHeaderCell>Versión</TableHeaderCell>
          <TableHeaderCell>Activa</TableHeaderCell>
          <TableHeaderCell>Eventos</TableHeaderCell>
          <TableHeaderCell>Entregas</TableHeaderCell>
          <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {items.map((s) => (
          <TableRow key={s.suscripcionId} className={selectedId === s.suscripcionId ? 'bg-gold-soft' : undefined}>
            <TableCell className="text-small">
              <div className="num break-all font-semibold text-ink">{s.owner}</div>
              <div className="mt-1 text-muted">Creada {fecha(s.creadaEn)}</div>
            </TableCell>
            <TableCell className="num max-w-[18rem] break-all text-small">{s.url}</TableCell>
            <TableCell className="text-small font-medium">v{s.apiVersion}</TableCell>
            <TableCell>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.activa ? 'bg-success-soft text-success' : 'bg-line text-ink'}`}>{s.activa ? 'Sí' : 'No'}</span>
            </TableCell>
            <TableCell className="text-small">
              <details>
                <summary className="cursor-pointer font-medium text-ink" title={s.eventos.join(', ')}>
                  {s.eventos.length} evento(s)
                </summary>
                <ul className="num mt-1 space-y-0.5 text-muted">
                  {s.eventos.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </details>
            </TableCell>
            <TableCell className="text-small">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-success-soft px-2 py-0.5 font-medium text-success">{s.entregas.entregadas} entregadas</span>
                <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning">{s.entregas.pendientes} pendientes</span>
                <span className={`rounded-full px-2 py-0.5 font-medium ${s.entregas.muertas > 0 ? 'bg-danger-soft text-danger' : 'bg-line text-ink'}`}>{s.entregas.muertas} sin entregar</span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <Button type="button" size="sm" variant="outline" aria-label={`Ver las entregas de ${s.owner}`} onClick={() => onPick(s)}>
                Ver entregas
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    {items.length === 0 && <EmptyState icon={<Send />} headingLevel={4} title="No hay suscripciones registradas" description="Cuando un socio se suscriba a los avisos, aparecerá aquí." />}
  </>
);

const DeliveryRow: React.FC<{ d: WebhookEntrega; busy: boolean; onRetry: (d: WebhookEntrega) => void }> = ({ d, busy, onRetry }) => (
  <TableRow>
    <TableCell className="num text-small">{fecha(d.creadaEn)}</TableCell>
    <TableCell className="text-small">
      <div className="num font-semibold text-ink">{d.tipo}</div>
      <div className="num break-all text-muted" title={d.url ?? undefined}>
        {d.owner ?? '—'}
      </div>
    </TableCell>
    <TableCell className="text-small">
      <div className="num font-semibold">{d.pnr ?? '—'}</div>
      <div className="num break-all text-muted">{d.partnerOrderId ?? '—'}</div>
    </TableCell>
    <TableCell>
      <EstadoBadge estado={d.estado} />
      {d.entregadaEn && <div className="num mt-1 text-small text-muted">{fecha(d.entregadaEn)}</div>}
    </TableCell>
    <TableCell className="num text-center text-small">{d.intentos}</TableCell>
    <TableCell className="max-w-[16rem] text-small">
      {d.ultimoCodigo != null && <span className={`num font-semibold ${d.ultimoCodigo >= 200 && d.ultimoCodigo < 300 ? 'text-success' : 'text-danger'}`}>HTTP {d.ultimoCodigo}</span>}
      {d.ultimoError && (
        <div className="break-words text-danger" title={d.ultimoError}>
          {d.ultimoError.length > 120 ? `${d.ultimoError.slice(0, 120)}…` : d.ultimoError}
        </div>
      )}
      {d.ultimoCodigo == null && !d.ultimoError && <span className="text-muted">—</span>}
    </TableCell>
    <TableCell className="num text-small">{fecha(d.proximoIntento)}</TableCell>
    <TableCell className="text-right">
      {(d.estado === 'DEAD' || d.estado === 'PENDING') && (
        <Button type="button" size="sm" variant={d.estado === 'DEAD' ? 'danger' : 'outline'} disabled={busy} aria-label={`Reintentar la entrega ${d.tipo} ${d.pnr ?? d.deliveryId}`} onClick={() => onRetry(d)}>
          Reintentar
        </Button>
      )}
    </TableCell>
  </TableRow>
);

/** ADMIN only: what reached each webhook receiver (Booking among them), with retries of undelivered ones. */
export const AdminWebhooksPage: React.FC = () => {
  const session = useSession();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const initialEstado = searchParams.get('estado');
  const initial: FiltrosForm = { estado: isEstado(initialEstado) ? initialEstado : '', tipo: searchParams.get('tipo') ?? '', owner: searchParams.get('owner') ?? '' };

  const [draft, setDraft] = useState<FiltrosForm>(initial);
  const [filters, setFilters] = useState<WebhookEntregasFilters>(() => toFilters(initial));
  const [suscripcion, setSuscripcion] = useState<WebhookSuscripcion | null>(null);
  const [pagina, setPagina] = useState(1);

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
    retry.mutate(d.deliveryId, { onSuccess: (r) => toast.success(`${d.tipo}${d.pnr ? ` (${d.pnr})` : ''}: ${r.mensaje}`) });
  };

  return (
    <section aria-label="Webhooks" className="space-y-6">
      <div>
        <AdminPageHeader
          page="webhooks"
          description="Los webhooks son los avisos automáticos que enviamos a socios como Booking cuando algo cambia, por ejemplo una reserva cancelada. Cada aviso enviado es una entrega. «Reintentar» vuelve a enviar una entrega que no llegó."
          actions={
            <Button type="button" variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${entregas.isFetching || subs.isFetching ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
              {entregas.dataUpdatedAt ? `Actualizar · ${new Date(entregas.dataUpdatedAt).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil' })}` : 'Actualizar'}
            </Button>
          }
        />
        <details className="-mt-3 rounded-xl border border-line bg-surface px-4 py-3 text-small text-muted">
          <summary className="cursor-pointer font-medium text-ink">Cuándo se reintenta una entrega</summary>
          <p className="mt-2">
            El sistema envía cada {WEBHOOKS_REFRESH_MS / 1000} s y, si el socio no responde bien, reintenta a 1 min, 5 min, 30 min, 2 h y 6 h. Después de eso la entrega queda «Sin entregar» y se puede reintentar a mano. Esta página se actualiza sola con el mismo ritmo. Las horas se muestran en hora de Ecuador.
          </p>
        </details>
      </div>

      <div>
        <h2 className="mb-2 text-body font-semibold text-ink">Suscripciones</h2>
        {subs.error != null ? (
          <ProblemAlert error={subs.error} onRetry={() => subs.refetch()} />
        ) : !subs.data ? (
          <div role="status" aria-busy="true" aria-label="Cargando">
            <Skeleton className="h-24 w-full rounded-xl" />
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
        <h2 className="mb-2 text-body font-semibold text-ink">Entregas (más recientes primero)</h2>
        <FilterPanel defaultOpen activeCount={Object.keys(filters).length}>
          <form onSubmit={apply} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select label="Estado" value={draft.estado} onChange={(e) => set('estado', e.target.value as FiltrosForm['estado'])}>
              <option value="">Todos</option>
              {ESTADOS_ENTREGA.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_LABEL[e]}
                </option>
              ))}
            </Select>
            <Input label="Tipo de evento" placeholder="Parte del nombre del evento" maxLength={40} value={draft.tipo} onChange={(e) => set('tipo', e.target.value)} />
            <Input label="Dueño" placeholder="Id del socio o de la persona" maxLength={100} value={draft.owner} onChange={(e) => set('owner', e.target.value)} />
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

        {suscripcion && (
          <p role="status" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-gold-soft p-3 text-small text-ink">
            Solo las entregas de la suscripción de <span className="num font-semibold">{suscripcion.owner}</span> ({suscripcion.url}).
            <button type="button" className="font-medium underline" onClick={() => setSuscripcion(null)}>
              Ver todas
            </button>
          </p>
        )}

        <div aria-live="polite" className="space-y-3">
          {retry.error != null && <ProblemAlert error={retry.error} message={adminErrorMessage(retry.error, 'reintentar-webhook')} className="mb-3" />}
        </div>
        {entregas.error != null && <ProblemAlert error={entregas.error} onRetry={() => entregas.refetch()} className="mb-3" />}

        <Table label="Entregas de webhooks" className="min-w-[1100px]" aria-busy={entregas.isFetching}>
          <TableHead>
            <tr>
              <TableHeaderCell>Fecha (hora de Ecuador)</TableHeaderCell>
              <TableHeaderCell>Tipo / dueño</TableHeaderCell>
              <TableHeaderCell>PNR / orden socio</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell className="text-center">Intentos</TableHeaderCell>
              <TableHeaderCell>Último código / error</TableHeaderCell>
              <TableHeaderCell>Próximo intento</TableHeaderCell>
              <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
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
          </TableBody>
        </Table>
        {!entregas.isLoading && data && data.items.length === 0 && <EmptyState icon={<Send />} headingLevel={4} title="No hay entregas con estos filtros" description="Cambia el estado o el tipo de evento." />}

        {data && data.total > 0 && (
          <nav aria-label="Paginación de entregas" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-small text-muted">
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
