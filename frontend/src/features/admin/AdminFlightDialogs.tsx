import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useCancelarVuelo,
  useCrearVuelo,
  useEditarVuelo,
  useEliminarVuelo,
  useReprogramarVuelo,
  type AdminVueloView,
} from '../../api/endpoints/admin';
import { useLocalidades } from '../../api/endpoints/catalog';
import { ProblemDetailsError } from '../../api/problem-details';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { formatDateTime } from '../../lib/labels';
import { adminErrorMessage } from './admin-errors';
import {
  editFlightSchema,
  isoToUtcLocal,
  newFlightSchema,
  rescheduleSchema,
  toNumber,
  utcLocalToIso,
  type EditFlightForm,
  type NewFlightForm,
  type RescheduleForm,
} from './admin-schemas';
import { ConfirmDialog } from './ConfirmDialog';

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
export const CreateFlightDialog: React.FC<{ onClose: () => void; onDone: (message: string) => void }> = ({ onClose, onDone }) => {
  const crear = useCrearVuelo();
  const localidades = useLocalidades();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewFlightForm>({ resolver: zodResolver(newFlightSchema), defaultValues: { capacidad: '180' } });

  const airports = [
    { value: '', label: 'Elige un aeropuerto' },
    ...(localidades.data ?? []).map((l) => ({ value: l.iata, label: `${l.iata} · ${l.ciudad} (${l.nombre})` })),
  ];

  const onSubmit = (form: NewFlightForm) =>
    crear.mutate(
      {
        codigoVuelo: form.codigoVuelo,
        aerolinea: form.aerolinea,
        origen: form.origen,
        destino: form.destino,
        salida: utcLocalToIso(form.salida),
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
    <Dialog isOpen onClose={onClose} title="Nuevo vuelo" description="La hora de salida se ingresa en UTC." maxWidth="lg">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {crear.error != null && <ProblemAlert error={crear.error} message={adminErrorMessage(crear.error, 'crear-vuelo')} />}
        {localidades.isError && <ProblemAlert error={localidades.error} onRetry={() => localidades.refetch()} title="No pudimos cargar los aeropuertos" />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Código de vuelo" placeholder="LA900" maxLength={6} autoComplete="off" error={errors.codigoVuelo?.message} {...register('codigoVuelo')} />
          <Input label="Aerolínea" placeholder="LATAM Airlines" autoComplete="off" error={errors.aerolinea?.message} {...register('aerolinea')} />
          <Select label="Origen" options={airports} error={errors.origen?.message} {...register('origen')} />
          <Select label="Destino" options={airports} error={errors.destino?.message} {...register('destino')} />
          <Input label="Salida (UTC)" type="datetime-local" error={errors.salida?.message} {...register('salida')} />
          <Input label="Duración (minutos)" type="number" inputMode="numeric" min={20} max={1500} error={errors.duracionMinutos?.message} {...register('duracionMinutos')} />
          <Input label="Tarifa base (USD)" inputMode="decimal" placeholder="120.00" error={errors.precioBaseUsd?.message} {...register('precioBaseUsd')} />
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
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RescheduleForm>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: { nuevaSalida: isoToUtcLocal(flight.salida), motivo: '' },
  });

  const onSubmit = (form: RescheduleForm) => {
    reprogramar.mutate(
      { vueloId: flight.vueloId, nuevaSalida: utcLocalToIso(form.nuevaSalida), motivo: form.motivo || undefined },
      {
        onSuccess: (r) => {
          onDone(`Vuelo ${flight.codigoVuelo} reprogramado. Reservas actualizadas: ${r.reservasAfectadas}.`);
          onClose();
        },
      },
    );
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={`Reprogramar vuelo ${flight.codigoVuelo}`}
      description={`Salida actual: ${formatDateTime(flight.salida)} UTC. Las reservas confirmadas se mueven a la nueva hora y se avisa por webhooks.`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {reprogramar.error != null && <ProblemAlert error={reprogramar.error} message={adminErrorMessage(reprogramar.error, 'reprogramar-vuelo')} />}
        <Input label="Nueva salida (UTC)" type="datetime-local" error={errors.nuevaSalida?.message} {...register('nuevaSalida')} />
        <Input label="Motivo (opcional)" maxLength={300} error={errors.motivo?.message} {...register('motivo')} />
        <Actions onClose={onClose} busy={reprogramar.isPending} submitLabel="Reprogramar" />
      </form>
    </Dialog>
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
