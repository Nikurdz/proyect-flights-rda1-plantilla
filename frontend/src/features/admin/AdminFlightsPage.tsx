import React, { useState } from 'react';
import { Plus, Plane } from 'lucide-react';
import { useAdminAsientosVuelo, useAdminVuelos, type AdminFlightsFilters, type AdminVueloView } from '../../api/endpoints/admin';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../../components/ui/Table';
import { useToast } from '../../lib/toast';
import { AdminPageHeader } from './AdminPageHeader';
import { RowActionsMenu } from './RowActionsMenu';
import { CancelFlightDialog, CreateFlightDialog, DeleteFlightDialog, EditFlightDialog, FlightStatusDialog, RescheduleFlightDialog } from './AdminFlightDialogs';
import { Skeleton } from '../../components/ui/Skeleton';
import { SeatLegend, SeatMap } from '../checkout/SeatMap';
import { formatAdminDateTime } from '../../lib/labels';
import { useSession } from '../../lib/session';

/** The cabin of one flight with its reserved seats; read only. */
const FlightSeatsDialog: React.FC<{ flight: AdminVueloView | null; ownerId?: string; onClose: () => void }> = ({ flight, ownerId, onClose }) => {
  const { data, isLoading, error, refetch } = useAdminAsientosVuelo(flight?.vueloId, ownerId);
  const takenInfo = React.useMemo(() => new Map((data?.reservados ?? []).map((r) => [r.asiento, `reserva ${r.pnr}`])), [data]);

  return (
    <Dialog isOpen={Boolean(flight)} onClose={onClose} title={flight ? `Asientos del vuelo ${flight.codigoVuelo} · ${flight.origen} → ${flight.destino}` : ''} maxWidth="2xl">
      {error != null ? (
        <ProblemAlert error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div role="status" aria-busy="true" aria-label="Cargando"><Skeleton className="h-72 w-full rounded-2xl" /></div>
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-muted">
            Salida {formatAdminDateTime(data.salida)} · <strong>{data.reservados.length}</strong> asiento(s) reservados de {data.capacidadTotal}. Quien no eligió asiento no aparece aquí.
          </p>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_1fr]">
            <div className="max-h-[26rem] overflow-y-auto rounded-3xl">
              <SeatMap filas={data.filas} picks={new Map()} onSelect={() => undefined} takenInfo={takenInfo} />
            </div>
            <div>
              <h3 className="mb-2 text-small font-semibold text-ink">Reservados</h3>
              {data.reservados.length === 0 ? (
                <p className="text-xs text-muted">Ningún asiento reservado todavía.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">Asientos reservados</caption>
                  <thead className="text-muted">
                    <tr>
                      <th scope="col" className="py-1 pr-3 font-semibold">Asiento</th>
                      <th scope="col" className="py-1 pr-3 font-semibold">Reserva</th>
                      <th scope="col" className="py-1 font-semibold">Orden</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line font-mono">
                    {data.reservados.map((r) => (
                      <tr key={r.asiento}>
                        <td className="py-1.5 pr-3 font-bold text-ink">{r.asiento}</td>
                        <td className="py-1.5 pr-3">{r.pnr || '—'}</td>
                        <td className="py-1.5">{r.numeroOrden ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <SeatLegend />
        </div>
      )}
    </Dialog>
  );
};

export const AdminFlightsPage: React.FC = () => {
  const session = useSession();
  const toast = useToast();
  const [openFlight, setOpenFlight] = useState<AdminVueloView | null>(null);
  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState<{ kind: 'edit' | 'reschedule' | 'status' | 'cancel' | 'delete'; flight: AdminVueloView } | null>(null);
  const closeAction = () => setAction(null);
  const done = (message: string) => toast.success(message);
  const [draft, setDraft] = useState<AdminFlightsFilters>({});
  const [filters, setFilters] = useState<AdminFlightsFilters>({});

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminVuelos(filters, session?.ownerId);
  const flights = data?.pages.flatMap((page) => page.items) ?? [];

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters(Object.fromEntries(Object.entries(draft).filter(([, value]) => value)) as AdminFlightsFilters);
  };

  const clear = () => {
    setDraft({});
    setFilters({});
  };

  return (
    <section aria-label="Vuelos">
      <AdminPageHeader
        page="vuelos"
        description="Crea, edita, reprograma, cancela o elimina vuelos. Las horas se muestran y se ingresan en hora de Ecuador."
        actions={
          <Button type="button" variant="accent" onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Nuevo vuelo
          </Button>
        }
      />
      <form onSubmit={apply} className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Input label="Origen" placeholder="Ej. BOG" maxLength={3} value={draft.origen ?? ''} onChange={(e) => setDraft({ ...draft, origen: e.target.value })} />
        <Input label="Destino" placeholder="Ej. SCL" maxLength={3} value={draft.destino ?? ''} onChange={(e) => setDraft({ ...draft, destino: e.target.value })} />
        <Input label="Fecha de salida" type="date" value={draft.fecha ?? ''} onChange={(e) => setDraft({ ...draft, fecha: e.target.value })} />
        <Input label="N.º de vuelo" placeholder="Ej. LA800" maxLength={6} value={draft.vuelo ?? ''} onChange={(e) => setDraft({ ...draft, vuelo: e.target.value })} />
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

      <Table label="Vuelos programados" className="min-w-[960px]">
        <TableHead>
          <tr>
            <TableHeaderCell>Vuelo</TableHeaderCell>
            <TableHeaderCell>Ruta</TableHeaderCell>
            <TableHeaderCell>Salida (hora de Ecuador)</TableHeaderCell>
            <TableHeaderCell>Aerolínea</TableHeaderCell>
            <TableHeaderCell className="text-right">Tarifa base</TableHeaderCell>
            <TableHeaderCell className="text-right">Libres</TableHeaderCell>
            <TableHeaderCell className="text-right">Asientos reservados</TableHeaderCell>
            <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {isLoading && (
            <tr>
              <td colSpan={8} className="p-4">
                <div role="status" aria-busy="true" aria-label="Cargando">
                  <Skeleton className="h-24 w-full" />
                </div>
              </td>
            </tr>
          )}
          {flights.map((flight) => {
            const low = flight.asientosDisponibles <= Math.max(5, flight.capacidadTotal * 0.1);
            return (
              <TableRow key={flight.vueloId}>
                <TableCell className="num font-semibold text-ink">
                  <button type="button" className="rounded underline-offset-2 hover:underline" onClick={() => setOpenFlight(flight)} aria-label={`Ver asientos del vuelo ${flight.codigoVuelo}`}>
                    {flight.codigoVuelo}
                  </button>
                </TableCell>
                <TableCell className="font-medium">
                  {flight.origen} → {flight.destino}
                </TableCell>
                <TableCell className="text-muted">
                  <span className="num">{formatAdminDateTime(flight.salida)}</span>
                  {flight.estado && flight.estado !== 'SCHEDULED' && (
                    <div className="mt-1 font-semibold text-ink" data-testid={`estado-${flight.vueloId}`}>
                      {flight.estado}
                      {flight.salidaEstimada ? ` · est. ${formatAdminDateTime(flight.salidaEstimada)}` : ''}
                      {flight.puertaSalida ? ` · puerta ${flight.puertaSalida}` : ''}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted">{flight.aerolinea}</TableCell>
                <TableCell className="text-right">
                  <MoneyText amount={flight.precioBaseUsd.toFixed(2)} currency="USD" />
                </TableCell>
                <TableCell className={`num text-right font-semibold ${low ? 'text-danger' : 'text-ink'}`}>
                  {low && <span className="sr-only">Pocos asientos libres: </span>}
                  {flight.asientosDisponibles} / {flight.capacidadTotal}
                </TableCell>
                <TableCell className="num text-right font-semibold">{flight.asientosReservados}</TableCell>
                <TableCell className="text-right">
                  <RowActionsMenu
                    subject={`vuelo ${flight.codigoVuelo}`}
                    actions={[
                      { label: 'Ver asientos', onSelect: () => setOpenFlight(flight) },
                      { label: 'Editar', onSelect: () => setAction({ kind: 'edit', flight }) },
                      { label: 'Reprogramar', onSelect: () => setAction({ kind: 'reschedule', flight }) },
                      { label: 'Cambiar estado', onSelect: () => setAction({ kind: 'status', flight }) },
                      { label: 'Cancelar vuelo', onSelect: () => setAction({ kind: 'cancel', flight }), destructive: true, separated: true },
                      { label: 'Eliminar', onSelect: () => setAction({ kind: 'delete', flight }), destructive: true },
                    ]}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!isLoading && flights.length === 0 && !error && (
        <EmptyState icon={<Plane />} title="No hay vuelos con estos filtros" description="Cambia los filtros o crea un vuelo nuevo." headingLevel={2} />
      )}

      {hasNextPage && (
        <div className="pt-5 text-center">
          <Button variant="outline" onClick={() => fetchNextPage()} isLoading={isFetchingNextPage}>
            Cargar más
          </Button>
        </div>
      )}

      <p className="mt-3 text-small text-muted">Usa el código del vuelo para ver su mapa de asientos y cuáles están reservados.</p>
      {creating && <CreateFlightDialog onClose={() => setCreating(false)} onDone={done} />}
      {action?.kind === 'edit' && <EditFlightDialog key={action.flight.vueloId} flight={action.flight} onClose={closeAction} onDone={done} />}
      {action?.kind === 'reschedule' && <RescheduleFlightDialog key={action.flight.vueloId} flight={action.flight} onClose={closeAction} onDone={done} />}
      {action?.kind === 'status' && <FlightStatusDialog key={action.flight.vueloId} flight={action.flight} onClose={closeAction} onDone={done} />}
      {action?.kind === 'cancel' && <CancelFlightDialog key={action.flight.vueloId} flight={action.flight} onClose={closeAction} onDone={done} />}
      {action?.kind === 'delete' && (
        <DeleteFlightDialog key={action.flight.vueloId} flight={action.flight} onClose={closeAction} onDone={done} onSwitchToCancel={(flight) => setAction({ kind: 'cancel', flight })} />
      )}
      <FlightSeatsDialog flight={openFlight} ownerId={session?.ownerId} onClose={() => setOpenFlight(null)} />
    </section>
  );
};
