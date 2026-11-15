import React, { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useCambiarEstadoVuelo,
  useCancelarVuelo,
  useCrearVuelo,
  useEditarVuelo,
  useEliminarVuelo,
  useReprogramarVuelo,
  useAdminVuelos,
  type AdminVueloView,
} from '../../api/endpoints/admin';
import { useLocalidades } from '../../api/endpoints/catalog';
import { ProblemDetailsError } from '../../api/problem-details';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SuggestInput } from '../../components/ui/SuggestInput';
import { normalizeText } from '../../lib/suggestions';
import { TriangleAlert } from 'lucide-react';
import { formatDuration, suggestDuration, suggestPrice } from '../../lib/flight-estimates';
import { useSession } from '../../lib/session';
import { formatAdminDateTime } from '../../lib/labels';
import { adminErrorMessage } from './admin-errors';
import {
  editFlightSchema,
  FLIGHT_STATUSES,
  flightStatusBody,
  flightStatusSchema,
  isoToEcuadorLocal,
  newFlightSchema,
  rescheduleSchema,
  toNumber,
  ecuadorLocalToIso,
  type EditFlightForm,
  type FlightStatusForm,
  type NewFlightForm,
  type RescheduleForm,
} from './admin-schemas';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

const Actions: React.FC<{ onClose: () => void; busy: boolean; submitLabel: string }> = ({ onClose, busy, submitLabel }) => (
  <div className="flex flex-wrap justify-end gap-2 pt-1">
    <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
      Cancelar
    </Button>
    <Button type="submit" variant="primary" isLoading={busy}>
      {submitLabel}
    </Button>
  </div>
);

/*
 * Each dialog is mounted only while it is open (the page renders it with a `key`), so its form and
 * mutation state start clean every time without a reset effect.
 */
/** Aerolíneas del seed: respaldo cuando todavía no hay vuelos de esa aerolínea cargados. Código de 2 caracteres -> nombre. */
const SEED_CARRIERS: Readonly<Record<string, string>> = {
  LA: 'LATAM Airlines',
  AV: 'Avianca',
  CM: 'Copa Airlines',
  G3: 'Gol Linhas Aéreas',
  AR: 'Aerolíneas Argentinas',
  UX: 'Air Europa',
};

const IATA_RE = /^[A-Z]{3}$/;

const Warning: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <p id={id} role="status" className="mt-1.5 flex items-start gap-1.5 text-sm text-ink">
    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
    {children}
  </p>
);

/** «Sugerido: … · Usar»: solo rellena al pulsar «Usar», nunca por su cuenta. */
const SuggestionChip: React.FC<{ text: string; onUse: () => void; label: string }> = ({ text, onUse, label }) => (
  <div className="mt-1.5 inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-ink/5 py-1 pl-3 pr-1 text-sm text-ink">
    <span className="min-w-0 truncate">{text}</span>
    <button
      type="button"
      onClick={onUse}
      aria-label={label}
      className="shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-sm font-semibold text-ink ring-1 ring-line-strong hover:bg-ink/10"
    >
      Usar
    </button>
  </div>
);

export const CreateFlightDialog: React.FC<{ onClose: () => void; onDone: (message: string) => void }> = ({ onClose, onDone }) => {
  const crear = useCrearVuelo();
  const localidades = useLocalidades();
  const session = useSession();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<NewFlightForm>({ resolver: zodResolver(newFlightSchema), defaultValues: { capacidad: '180' } });

  const [codigo, aerolinea, origenRaw, destinoRaw, duracion, precio] = useWatch({
    control,
    name: ['codigoVuelo', 'aerolinea', 'origen', 'destino', 'duracionMinutos', 'precioBaseUsd'],
  });
  const origen = (origenRaw ?? '').trim().toUpperCase();
  const destino = (destinoRaw ?? '').trim().toUpperCase();
  const routeReady = IATA_RE.test(origen) && IATA_RE.test(destino) && origen !== destino;

  // Vuelos ya cargados: de ellos salen las aerolíneas conocidas y los datos de la misma ruta.
  const allFlights = useAdminVuelos({}, session?.ownerId);
  const routeFlights = useAdminVuelos(routeReady ? { origen, destino } : {}, session?.ownerId);

  const airports = React.useMemo(
    () => (Array.isArray(localidades.data) ? localidades.data : []).map((l) => ({ value: l.iata, label: `${l.iata} · ${l.ciudad}`, hint: l.nombre })),
    [localidades.data],
  );

  // Prefijo del código de vuelo -> nombre de aerolínea (lo cargado manda sobre el seed).
  const carriersByPrefix = React.useMemo(() => {
    const map = new Map<string, string>(Object.entries(SEED_CARRIERS));
    for (const f of allFlights.data?.pages.flatMap((p) => p.items) ?? []) map.set(f.codigoVuelo.slice(0, 2).toUpperCase(), f.aerolinea);
    return map;
  }, [allFlights.data]);
  const airlineSuggestions = React.useMemo(() => [...new Set(carriersByPrefix.values())].map((name) => ({ value: name })), [carriersByPrefix]);

  const typedAirline = normalizeText(aerolinea ?? '');
  const prefix = (codigo ?? '').trim().toUpperCase().slice(0, 2);
  const prefixOwner = prefix.length === 2 ? carriersByPrefix.get(prefix) : undefined;
  const airlineKnown = airlineSuggestions.some((s) => normalizeText(s.value) === typedAirline);
  let airlineWarning: string | null = null;
  if (prefixOwner && typedAirline.length >= 2 && normalizeText(prefixOwner) !== typedAirline) {
    airlineWarning = `El código ${prefix} ya pertenece a ${prefixOwner}; se conservará ese nombre.`;
  } else if (!prefixOwner && typedAirline.length >= 2 && !airlineKnown) {
    airlineWarning = 'No existe; se creará una nueva.';
  }

  const routeList = React.useMemo(() => routeFlights.data?.pages.flatMap((p) => p.items) ?? [], [routeFlights.data]);
  const durationHint = routeReady ? suggestDuration(origen, destino, routeList) : null;
  const priceHint = routeReady ? suggestPrice(origen, destino, routeList) : null;
  const useDuration = () => durationHint && setValue('duracionMinutos', String(durationHint.minutes), { shouldValidate: true, shouldDirty: true });
  const usePrice = () => priceHint && setValue('precioBaseUsd', priceHint.amount.toFixed(2), { shouldValidate: true, shouldDirty: true });

  const onSubmit = (form: NewFlightForm) =>
    crear.mutate(
      {
        codigoVuelo: form.codigoVuelo,
        aerolinea: form.aerolinea,
        origen: form.origen,
        destino: form.destino,
        salida: ecuadorLocalToIso(form.salida),
        duracionMinutos: Number(form.duracionMinutos),
        precioBaseUsd: toNumber(form.precioBaseUsd),
        ...(form.capacidad ? { capacidad: Number(form.capacidad) } : {}),
      },
      {
        onSuccess: (vuelo) => {
          onDone(`Vuelo ${vuelo.codigoVuelo} creado.`);
          onClose();
        },
      },
    );

  return (
    <Dialog isOpen onClose={onClose} title="Nuevo vuelo" description="La hora de salida se ingresa en hora de Ecuador (UTC-5)." maxWidth="lg">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {crear.error != null && <ProblemAlert error={crear.error} message={adminErrorMessage(crear.error, 'crear-vuelo')} />}
        {localidades.isError && <ProblemAlert error={localidades.error} onRetry={() => localidades.refetch()} title="No pudimos cargar los aeropuertos" />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Código de vuelo" placeholder="LA900" maxLength={6} autoComplete="off" error={errors.codigoVuelo?.message} {...register('codigoVuelo')} />
          <div>
            <SuggestInput
              label="Aerolínea"
              placeholder="LATAM Airlines"
              suggestions={airlineSuggestions}
              aria-describedby={airlineWarning ? 'aerolinea-aviso' : undefined}
              error={errors.aerolinea?.message}
              {...register('aerolinea')}
            />
            {airlineWarning && !errors.aerolinea && <Warning id="aerolinea-aviso">{airlineWarning}</Warning>}
          </div>
          <SuggestInput label="Origen" placeholder="Código o ciudad, ej. UIO" suggestions={airports} maxLength={40} error={errors.origen?.message} {...register('origen')} />
          <SuggestInput label="Destino" placeholder="Código o ciudad, ej. GYE" suggestions={airports} maxLength={40} error={errors.destino?.message} {...register('destino')} />
          <Input label="Salida (hora de Ecuador)" type="datetime-local" error={errors.salida?.message} {...register('salida')} />
          <div>
            <Input label="Duración (minutos)" type="number" inputMode="numeric" min={20} max={1500} error={errors.duracionMinutos?.message} {...register('duracionMinutos')} />
            {durationHint && !duracion && (
              <SuggestionChip
                text={`Sugerido: ${formatDuration(durationHint.minutes)} (${durationHint.source === 'ruta' ? 'según vuelos de esta ruta' : 'según la distancia'})`}
                label={`Usar la duración sugerida de ${durationHint.minutes} minutos`}
                onUse={useDuration}
              />
            )}
          </div>
          <div>
            <Input label="Tarifa base (USD)" inputMode="decimal" placeholder="120.00" error={errors.precioBaseUsd?.message} {...register('precioBaseUsd')} />
            {priceHint && !precio && (
              <SuggestionChip
                text={`Sugerido: ${priceHint.amount.toFixed(2)} USD${priceHint.range ? ` (rango ${priceHint.range.min}–${priceHint.range.max})` : ' (según la distancia)'}`}
                label={`Usar la tarifa sugerida de ${priceHint.amount.toFixed(2)} dólares`}
                onUse={usePrice}
              />
            )}
          </div>
          <Input label="Capacidad" type="number" inputMode="numeric" min={1} max={400} helperText="De 1 a 400; por defecto 180." error={errors.capacidad?.message} {...register('capacidad')} />
        </div>
        <Actions onClose={onClose} busy={crear.isPending} submitLabel="Crear vuelo" />
      </form>
    </Dialog>
  );
};

export const EditFlightDialog: React.FC<{ flight: AdminVueloView; onClose: () => void; onDone: (message: string) => void }> = ({ flight, onClose, onDone }) => {
  const editar = useEditarVuelo();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditFlightForm>({
    resolver: zodResolver(editFlightSchema),
    defaultValues: {
      aerolinea: flight.aerolinea,
      precioBaseUsd: flight.precioBaseUsd.toFixed(2),
      duracionMinutos: String(flight.duracionMinutos),
      capacidadTotal: String(flight.capacidadTotal),
    },
  });

  const onSubmit = (form: EditFlightForm) => {
    editar.mutate(
      {
        vueloId: flight.vueloId,
        cambios: {
          aerolinea: form.aerolinea,
          precioBaseUsd: toNumber(form.precioBaseUsd),
          duracionMinutos: Number(form.duracionMinutos),
          capacidadTotal: Number(form.capacidadTotal),
        },
      },
      {
        onSuccess: () => {
          onDone(`Vuelo ${flight.codigoVuelo} actualizado.`);
          onClose();
        },
      },
    );
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={`Editar vuelo ${flight.codigoVuelo}`}
      description={`${flight.origen} → ${flight.destino} · ${flight.asientosReservados} asiento(s) reservado(s)`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {editar.error != null && <ProblemAlert error={editar.error} message={adminErrorMessage(editar.error, 'editar-vuelo')} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Aerolínea" error={errors.aerolinea?.message} {...register('aerolinea')} />
          <Input label="Tarifa base (USD)" inputMode="decimal" error={errors.precioBaseUsd?.message} {...register('precioBaseUsd')} />
          <Input label="Duración (minutos)" type="number" inputMode="numeric" error={errors.duracionMinutos?.message} {...register('duracionMinutos')} />
          <Input label="Capacidad total" type="number" inputMode="numeric" helperText="No puede ser menor que los asientos vendidos." error={errors.capacidadTotal?.message} {...register('capacidadTotal')} />
        </div>
        <Actions onClose={onClose} busy={editar.isPending} submitLabel="Guardar cambios" />
      </form>
    </Dialog>
  );
};

export const RescheduleFlightDialog: React.FC<{ flight: AdminVueloView; onClose: () => void; onDone: (message: string) => void }> = ({ flight, onClose, onDone }) => {
  const reprogramar = useReprogramarVuelo();
  const [pending, setPending] = useState<RescheduleForm | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RescheduleForm>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: { nuevaSalida: isoToEcuadorLocal(flight.salida), motivo: '' },
  });

  const send = (form: RescheduleForm) => {
    reprogramar.mutate(
      { vueloId: flight.vueloId, nuevaSalida: ecuadorLocalToIso(form.nuevaSalida), motivo: form.motivo || undefined },
      {
        onSuccess: (r) => {
          onDone(`Vuelo ${flight.codigoVuelo} reprogramado. Reservas actualizadas: ${r.reservasAfectadas}.`);
          onClose();
        },
        onError: () => setPending(null),
      },
    );
  };

  // The form stays mounted (its values are kept) while the confirmation is shown instead of it.
  return (
    <>
      <Dialog
        isOpen={!pending}
        onClose={onClose}
        title={`Reprogramar vuelo ${flight.codigoVuelo}`}
        description={`Salida actual: ${formatAdminDateTime(flight.salida)} (hora de Ecuador). Antes de guardar te pediremos confirmar el cambio.`}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit((form) => setPending(form))} noValidate className="space-y-4">
          {reprogramar.error != null && <ProblemAlert error={reprogramar.error} message={adminErrorMessage(reprogramar.error, 'reprogramar-vuelo')} />}
          <Input label="Nueva salida (hora de Ecuador)" type="datetime-local" error={errors.nuevaSalida?.message} {...register('nuevaSalida')} />
          <Input label="Motivo (opcional)" maxLength={300} error={errors.motivo?.message} {...register('motivo')} />
          <Actions onClose={onClose} busy={false} submitLabel="Continuar" />
        </form>
      </Dialog>
      <ConfirmDialog
        isOpen={Boolean(pending)}
        title={`¿Reprogramar el vuelo ${flight.codigoVuelo}?`}
        confirmLabel="Reprogramar vuelo"
        cancelLabel="Volver"
        isLoading={reprogramar.isPending}
        onConfirm={() => pending && send(pending)}
        onClose={() => setPending(null)}
      >
        <p>
          La salida pasará de {formatAdminDateTime(flight.salida)} a {pending ? formatAdminDateTime(ecuadorLocalToIso(pending.nuevaSalida)) : ''} (hora de Ecuador).
        </p>
        <p className="mt-2">
          {flight.asientosReservados > 0
            ? `Hay ${flight.asientosReservados} asiento(s) reservado(s) en este vuelo: sus reservas confirmadas se moverán a la nueva hora.`
            : 'Las reservas confirmadas de este vuelo, si las hay, se moverán a la nueva hora.'}{' '}
          Avisaremos a los clientes y socios afectados.
        </p>
      </ConfirmDialog>
    </>
  );
};

export const CancelFlightDialog: React.FC<{ flight: AdminVueloView; onClose: () => void; onDone: (message: string) => void }> = ({ flight, onClose, onDone }) => {
  const cancelar = useCancelarVuelo();
  const [motivo, setMotivo] = useState('');

  const confirm = () => {
    cancelar.mutate(
      { vueloId: flight.vueloId, motivo: motivo.trim() || undefined },
      {
        onSuccess: (r) => {
          onDone(`Vuelo ${flight.codigoVuelo} cancelado. Reservas afectadas: ${r.reservasAfectadas}.`);
          onClose();
        },
      },
    );
  };

  return (
    <ConfirmDialog
      isOpen
      title={`Cancelar vuelo ${flight.codigoVuelo}`}
      confirmLabel="Cancelar vuelo"
      cancelLabel="Volver"
      destructive
      isLoading={cancelar.isPending}
      error={cancelar.error}
      errorMessage={adminErrorMessage(cancelar.error, 'cancelar-vuelo')}
      onConfirm={confirm}
      onClose={onClose}
    >
      <p>
        El vuelo se cierra a la venta y sus reservas confirmadas se cancelan y reembolsan. Los clientes reciben aviso.
      </p>
      <div className="mt-3">
        <Input label="Motivo (opcional)" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
    </ConfirmDialog>
  );
};

export const DeleteFlightDialog: React.FC<{
  flight: AdminVueloView;
  onClose: () => void;
  onDone: (message: string) => void;
  /** Cuando el vuelo tiene reservas (409 FLIGHT_IN_USE) se ofrece cancelarlo. */
  onSwitchToCancel: (flight: AdminVueloView) => void;
}> = ({ flight, onClose, onDone, onSwitchToCancel }) => {
  const eliminar = useEliminarVuelo();

  const inUse = eliminar.error instanceof ProblemDetailsError && eliminar.error.code === 'FLIGHT_IN_USE';

  const confirm = () => {
    eliminar.mutate(flight.vueloId, {
      onSuccess: () => {
        onDone(`Vuelo ${flight.codigoVuelo} eliminado.`);
        onClose();
      },
    });
  };

  return (
    <ConfirmDialog
      isOpen
      title={`Eliminar vuelo ${flight.codigoVuelo}`}
      confirmLabel="Eliminar vuelo"
      cancelLabel="Volver"
      destructive
      isLoading={eliminar.isPending}
      error={eliminar.error}
      errorMessage={adminErrorMessage(eliminar.error, 'eliminar-vuelo')}
      onConfirm={confirm}
      onClose={onClose}
    >
      <p>
        Se borra el vuelo y su cabina del sistema. Solo es posible si nunca tuvo reservas ni retenciones; si las tiene, usa «Cancelar vuelo».
      </p>
      {inUse && (
        <div className="mt-3">
          <Button type="button" variant="outline" onClick={() => onSwitchToCancel(flight)}>
            Cancelar vuelo en su lugar
          </Button>
        </div>
      )}
    </ConfirmDialog>
  );
};

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Programado',
  BOARDING: 'Embarcando',
  DEPARTED: 'Despegó',
  DELAYED: 'Retrasado',
  ARRIVED: 'Llegó',
  CANCELLED: 'Cancelado',
  DIVERTED: 'Desviado',
};

/** Operational status of a flight (delay, gate, boarding...). The server validates the transition. */
export const FlightStatusDialog: React.FC<{ flight: AdminVueloView; onClose: () => void; onDone: (message: string) => void }> = ({ flight, onClose, onDone }) => {
  const cambiar = useCambiarEstadoVuelo();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FlightStatusForm>({
    resolver: zodResolver(flightStatusSchema),
    defaultValues: { status: '' as FlightStatusForm['status'], estimatedDepartureAt: isoToEcuadorLocal(flight.salida), departureGate: '', reason: '' },
  });
  const delayed = useWatch({ control, name: 'status' }) === 'DELAYED';

  const onSubmit = (form: FlightStatusForm) => {
    cambiar.mutate(
      { vueloId: flight.vueloId, cambio: flightStatusBody(form) },
      {
        onSuccess: (r) => {
          onDone(`Vuelo ${flight.codigoVuelo}: ${STATUS_LABEL[r.previousStatus] ?? r.previousStatus} → ${STATUS_LABEL[form.status]}. Reservas afectadas: ${r.affectedBookings}. El nuevo estado ya es visible para los clientes y socios.`);
          onClose();
        },
      },
    );
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={`Estado del vuelo ${flight.codigoVuelo}`}
      description={`${flight.origen} → ${flight.destino} · salida programada ${formatAdminDateTime(flight.salida)}. Las horas se ingresan en hora de Ecuador.`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {cambiar.error != null && <ProblemAlert error={cambiar.error} message={adminErrorMessage(cambiar.error, 'estado-vuelo')} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Estado" error={errors.status?.message} {...register('status')}>
            <option value="">Elige un estado</option>
            {FLIGHT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Input
            label={delayed ? 'Salida estimada (hora de Ecuador) · obligatoria' : 'Salida estimada (hora de Ecuador)'}
            type="datetime-local"
            error={errors.estimatedDepartureAt?.message}
            {...register('estimatedDepartureAt')}
          />
          <Input label="Puerta de embarque" placeholder="B12" maxLength={10} autoComplete="off" error={errors.departureGate?.message} {...register('departureGate')} />
          <Input label="Motivo (opcional)" maxLength={300} error={errors.reason?.message} {...register('reason')} />
        </div>
        <Actions onClose={onClose} busy={cambiar.isPending} submitLabel="Guardar estado" />
      </form>
    </Dialog>
  );
};
