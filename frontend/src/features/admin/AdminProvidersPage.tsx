import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Download, Plus, RefreshCw, Server, Trash2 } from 'lucide-react';
import {
  PROVEEDORES_REFRESH_MS,
  useActualizarProveedor,
  useEliminarProveedor,
  usePingProveedor,
  useProveedores,
  useRegistrarProveedor,
  useSaludProveedor,
  useSincronizarProveedor,
} from '../../api/endpoints/proveedores';
import type { ProveedorView, SaludView } from '../../api/types';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDateTime } from '../../lib/labels';
import { TIPOS_SERVICIO, formatLatency, haceTiempo, puedeSincronizar, resumenFlota, resumenSincronizacion, tipoServicioLabel } from '../../lib/proveedores';
import { useSession } from '../../lib/session';
import { adminErrorMessage } from './admin-errors';
import { newProviderSchema, type NewProviderForm } from './provider-schemas';
import { ConfirmDialog } from './ConfirmDialog';
import { CircuitBadge, LedStatus } from './LedStatus';

const REFRESH_SECONDS = PROVEEDORES_REFRESH_MS / 1000;

const RegisterProviderForm: React.FC<{ onCreated: (nombre: string) => void }> = ({ onCreated }) => {
  const registrar = useRegistrarProveedor();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewProviderForm>({ resolver: zodResolver(newProviderSchema), defaultValues: { tipoServicio: 'ATRACCIONES' } });

  const onSubmit = (form: NewProviderForm) => {
    registrar.mutate(form, {
      onSuccess: (proveedor) => {
        reset({ nombre: '', equipo: '', baseUrl: '', tipoServicio: 'ATRACCIONES' });
        onCreated(proveedor.nombre);
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Registrar proveedor" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">Registrar proveedor</h2>
      <p className="mb-4 mt-0.5 text-xs text-slate-500">Un socio externo cuyo catálogo y reservas se integran por su API. La URL puede escribirse con o sin el sufijo /api/v2.</p>
      {registrar.error != null && <ProblemAlert error={registrar.error} message={adminErrorMessage(registrar.error, 'crear-proveedor')} className="mb-4" />}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.5fr_12rem_auto]">
        <Input label="Nombre" autoComplete="off" placeholder="Atracciones Quito" error={errors.nombre?.message} {...register('nombre')} />
        <Input label="Equipo" autoComplete="off" placeholder="Equipo Atracciones" error={errors.equipo?.message} {...register('equipo')} />
        <Input label="URL base" type="url" autoComplete="off" placeholder="https://atracciones.example.com/api/v2" error={errors.baseUrl?.message} {...register('baseUrl')} />
        <Select label="Tipo de servicio" options={TIPOS_SERVICIO} error={errors.tipoServicio?.message} {...register('tipoServicio')} />
        <div className="flex items-end">
          <Button type="submit" variant="accent" className="w-full xl:w-auto" isLoading={registrar.isPending}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Registrar
          </Button>
        </div>
      </div>
    </form>
  );
};

const HealthHistory: React.FC<{ proveedorId: string; ownerId?: string }> = ({ proveedorId, ownerId }) => {
  const { data, isLoading, error, refetch } = useSaludProveedor(proveedorId, ownerId);
  if (error != null) return <ProblemAlert error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) {
    return (
      <div role="status" aria-busy="true" aria-label="Cargando historial">
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (data.length === 0) return <p className="text-xs text-slate-500">Todavía no hay comprobaciones registradas.</p>;
  return (
    <div className="max-h-56 overflow-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Historial de comprobaciones, la más reciente primero</caption>
        <thead className="text-slate-500">
          <tr>
            <th scope="col" className="py-1 pr-3 font-semibold">Fecha (UTC)</th>
            <th scope="col" className="py-1 pr-3 font-semibold">Estado</th>
            <th scope="col" className="py-1 pr-3 text-right font-semibold">Latencia</th>
            <th scope="col" className="py-1 font-semibold">Detalle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((h: SaludView, i) => (
            <tr key={`${h.comprobadoEn}-${i}`}>
              <td className="py-1.5 pr-3 text-slate-600">{h.comprobadoEn ? formatDateTime(h.comprobadoEn) : '—'}</td>
              <td className="py-1.5 pr-3">
                <LedStatus estado={h.estado} />
              </td>
              <td className="py-1.5 pr-3 text-right font-mono">{formatLatency(h.latenciaMs)}</td>
              <td className="py-1.5 text-slate-600">{h.detalle ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

type Confirm = 'apagar' | 'eliminar' | null;

/** One provider: owns its own mutations so each card shows its own result and its own error. */
const ProviderCard: React.FC<{ proveedor: ProveedorView; ownerId?: string }> = ({ proveedor: p, ownerId }) => {
  const ping = usePingProveedor();
  const sync = useSincronizarProveedor();
  const patch = useActualizarProveedor();
  const eliminar = useEliminarProveedor();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const idBase = `prov-${p.id}`;
  const canSync = puedeSincronizar(p.tipoServicio);

  const closeConfirm = () => {
    setConfirm(null);
    patch.reset();
    eliminar.reset();
  };

  const toggle = () => {
    if (p.activo) {
      setConfirm('apagar');
    } else {
      patch.mutate({ id: p.id, cambios: { activo: true } });
    }
  };

  return (
    <li className={`rounded-2xl border bg-white p-5 shadow-sm ${p.activo ? 'border-slate-200' : 'border-slate-200 bg-slate-50'}`}>
      <article aria-labelledby={`${idBase}-name`}>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={`${idBase}-name`} className="truncate text-base font-black text-brand-black">
              {p.nombre}
            </h3>
            <p className="text-xs text-slate-600">
              {p.equipo} · <Badge variant="outline" size="sm">{tipoServicioLabel(p.tipoServicio)}</Badge>
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{p.baseUrl}</p>
          </div>
          <div className="flex items-center gap-2">
            <span id={`${idBase}-switch-label`} className="text-xs font-semibold text-slate-700">
              {p.activo ? 'Encendido' : 'Apagado'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={p.activo}
              aria-label={`Proveedor ${p.nombre} encendido`}
              disabled={patch.isPending}
              onClick={toggle}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-airline-blue focus-visible:ring-offset-2 disabled:opacity-50 ${p.activo ? 'border-emerald-600 bg-emerald-500' : 'border-slate-400 bg-slate-300'}`}
            >
              <span aria-hidden="true" className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${p.activo ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </header>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="font-bold uppercase tracking-wider text-slate-500">Estado</dt>
            <dd className="mt-1">
              <LedStatus estado={p.salud.estado} showHint />
            </dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-wider text-slate-500">Latencia</dt>
            <dd className="mt-1 font-mono text-sm font-bold text-slate-900">{formatLatency(p.salud.latenciaMs)}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-wider text-slate-500">Circuito</dt>
            <dd className="mt-1">
              <CircuitBadge circuito={p.circuito} />
            </dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-wider text-slate-500">Productos</dt>
            <dd className="mt-1 font-mono text-sm font-bold text-slate-900">{p.productos.toLocaleString('es-EC')}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] text-slate-500">
          Última comprobación: {haceTiempo(p.salud.comprobadoEn)}
          {p.salud.detalle ? ` · ${p.salud.detalle}` : ''}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={!p.activo || sync.isPending} isLoading={ping.isPending} onClick={() => ping.mutate(p.id)} aria-label={`Comprobar ${p.nombre} ahora`}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Comprobar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!p.activo || !canSync || ping.isPending}
            isLoading={sync.isPending}
            onClick={() => sync.mutate(p.id)}
            aria-label={`Sincronizar el catálogo de ${p.nombre}`}
            aria-describedby={!canSync ? `${idBase}-sync-hint` : undefined}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Sincronizar
          </Button>
          <Button type="button" size="sm" variant="outline" aria-expanded={historyOpen} aria-controls={`${idBase}-history`} onClick={() => setHistoryOpen((v) => !v)}>
            <ChevronDown className={`mr-1.5 h-3.5 w-3.5 transition-transform ${historyOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            Historial de salud
          </Button>
          <Button type="button" size="sm" variant="danger" className="ml-auto" onClick={() => setConfirm('eliminar')} aria-label={`Eliminar el proveedor ${p.nombre}`}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Eliminar
          </Button>
        </div>
        {!canSync && (
          <p id={`${idBase}-sync-hint`} className="mt-2 text-[11px] text-slate-500">
            La sincronización de catálogo solo está disponible para proveedores de Atracciones.
          </p>
        )}
        {!p.activo && <p className="mt-2 text-[11px] text-slate-600">Apagado: no se le llama, su catálogo está oculto y no acepta reservas. Enciéndelo para comprobarlo o sincronizarlo.</p>}

        <div aria-live="polite" className="mt-3 space-y-2">
          {ping.data && (
            <p role="status" className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
              <strong>Comprobación:</strong>
              <LedStatus estado={ping.data.estado} />
              <span className="font-mono">{formatLatency(ping.data.latenciaMs)}</span>
              {ping.data.detalle && <span className="text-slate-500">{ping.data.detalle}</span>}
            </p>
          )}
          {sync.data && (
            <p role="status" className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900">
              <strong>Sincronización lista.</strong> {resumenSincronizacion(sync.data)}
            </p>
          )}
        </div>
        {ping.error != null && <ProblemAlert error={ping.error} message={adminErrorMessage(ping.error, 'comprobar-proveedor')} onRetry={() => ping.mutate(p.id)} className="mt-3" />}
        {sync.error != null && <ProblemAlert error={sync.error} message={adminErrorMessage(sync.error, 'sincronizar-proveedor')} onRetry={canSync ? () => sync.mutate(p.id) : undefined} className="mt-3" />}
        {patch.error != null && confirm === null && <ProblemAlert error={patch.error} message={adminErrorMessage(patch.error, 'editar-proveedor')} className="mt-3" />}

        <div id={`${idBase}-history`} hidden={!historyOpen} className="mt-4 border-t border-slate-100 pt-3">
          {historyOpen && <HealthHistory proveedorId={p.id} ownerId={ownerId} />}
        </div>
      </article>

      <ConfirmDialog
        isOpen={confirm === 'apagar'}
        title="Apagar proveedor"
        confirmLabel="Apagar proveedor"
        isLoading={patch.isPending}
        error={patch.error}
        errorMessage={adminErrorMessage(patch.error, 'apagar-proveedor')}
        onConfirm={() => patch.mutate({ id: p.id, cambios: { activo: false } }, { onSuccess: closeConfirm })}
        onClose={closeConfirm}
      >
        <p>
          Vas a apagar a <strong>{p.nombre}</strong> (kill-switch).
        </p>
        <p className="mt-2 text-xs text-slate-500">Dejaremos de llamarlo, su catálogo se oculta a los clientes y no se aceptan reservas nuevas. Podrás encenderlo de nuevo cuando quieras.</p>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={confirm === 'eliminar'}
        title="Eliminar proveedor"
        confirmLabel="Eliminar proveedor"
        destructive
        isLoading={eliminar.isPending}
        error={eliminar.error}
        errorMessage={adminErrorMessage(eliminar.error, 'eliminar-proveedor')}
        onConfirm={() => eliminar.mutate(p.id, { onSuccess: closeConfirm })}
        onClose={closeConfirm}
      >
        <p>
          Vas a eliminar a <strong>{p.nombre}</strong> con su catálogo sincronizado y su historial de salud.
        </p>
        <p className="mt-2 text-xs text-slate-500">Si ya vendió alguna reserva no se podrá eliminar: en ese caso apágalo con el interruptor.</p>
      </ConfirmDialog>
    </li>
  );
};

const FleetTile: React.FC<{ label: string; value: number; tone?: 'danger' | 'warning' | 'success' | 'neutral' }> = ({ label, value, tone = 'neutral' }) => {
  const color = { danger: 'text-red-700', warning: 'text-amber-700', success: 'text-emerald-700', neutral: 'text-brand-black' }[value > 0 || tone === 'neutral' ? tone : 'neutral'];
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{label}</div>
      <div className={`mt-1 text-2xl font-black ${color}`}>{value}</div>
    </div>
  );
};

/** ADMIN only: register, watch (traffic light), switch off, synchronise and delete the partner providers. */
export const AdminProvidersPage: React.FC = () => {
  const session = useSession();
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useProveedores(session?.ownerId);
  const [notice, setNotice] = useState<string | null>(null);
  const proveedores = data ?? [];
  const flota = resumenFlota(proveedores);

  return (
    <section aria-label="Proveedores">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-brand-gold-dark" aria-hidden="true" />
          <h2 className="text-lg font-black text-brand-black">Proveedores</h2>
        </div>
        <button type="button" onClick={() => void refetch()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-black">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
          {dataUpdatedAt ? `Actualizado ${new Date(dataUpdatedAt).toLocaleTimeString('es-EC')}` : 'Actualizar'} · se refresca cada {REFRESH_SECONDS} s
        </button>
      </div>

      <RegisterProviderForm onCreated={(nombre) => setNotice(`Proveedor «${nombre}» registrado. Compruébalo y sincroniza su catálogo.`)} />

      {notice && (
        <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>{notice}</p>
          <button type="button" className="text-xs font-semibold underline" onClick={() => setNotice(null)}>
            Cerrar aviso
          </button>
        </div>
      )}

      {error != null && <ProblemAlert error={error} onRetry={() => refetch()} className="mb-4" />}

      {data && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4" role="group" aria-label="Resumen de proveedores">
          <FleetTile label="En línea" value={flota.enLinea} tone="success" />
          <FleetTile label="Degradados" value={flota.degradados} tone="warning" />
          <FleetTile label="Caídos" value={flota.caidos} tone="danger" />
          <FleetTile label="Apagados" value={flota.apagados} />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4" role="status" aria-busy="true" aria-label="Cargando">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : proveedores.length === 0 ? (
        !error && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
            Aún no hay proveedores. Registra el primero con el formulario de arriba.
          </div>
        )
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {proveedores.map((p) => (
            <ProviderCard key={p.id} proveedor={p} ownerId={session?.ownerId} />
          ))}
        </ul>
      )}
    </section>
  );
};
