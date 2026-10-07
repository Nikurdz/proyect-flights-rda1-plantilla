import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAdminAsientosVuelo, useAdminVuelos, type AdminFlightsFilters, type AdminVueloView } from '../../api/endpoints/admin';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { CancelFlightDialog, CreateFlightDialog, DeleteFlightDialog, EditFlightDialog, RescheduleFlightDialog } from './AdminFlightDialogs';
import { Skeleton } from '../../components/ui/Skeleton';
import { SeatLegend, SeatMap } from '../checkout/SeatMap';
import { formatDateTime } from '../../lib/labels';
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
          <p className="text-xs text-slate-600">
            Salida {formatDateTime(data.salida)} UTC · <strong>{data.reservados.length}</strong> asiento(s) reservados de {data.capacidadTotal}. Quien no eligió asiento no aparece aquí.
          </p>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_1fr]">
            <div className="max-h-[26rem] overflow-y-auto rounded-3xl">
              <SeatMap filas={data.filas} picks={new Map()} onSelect={() => undefined} takenInfo={takenInfo} />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Reservados</h3>
              {data.reservados.length === 0 ? (
                <p className="text-xs text-slate-500">Ningún asiento reservado todavía.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">Asientos reservados</caption>
                  <thead className="text-slate-500">
                    <tr>
                      <th scope="col" className="py-1 pr-3 font-semibold">Asiento</th>
                      <th scope="col" className="py-1 pr-3 font-semibold">Reserva</th>
                      <th scope="col" className="py-1 font-semibold">Orden</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {data.reservados.map((r) => (
                      <tr key={r.asiento}>
                        <td className="py-1.5 pr-3 font-bold text-brand-black">{r.asiento}</td>
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
  const [openFlight, setOpenFlight] = useState<AdminVueloView | null>(null);
  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState<{ kind: 'edit' | 'reschedule' | 'cancel' | 'delete'; flight: AdminVueloView } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const closeAction = () => setAction(null);
  const flightFor = (kind: 'edit' | 'reschedule' | 'cancel' | 'delete') => (action?.kind === kind ? action.flight : null);
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-600">Crea, edita, reprograma, cancela o elimina vuelos. Las horas se muestran y se ingresan en UTC.</p>
        <Button type="button" variant="accent" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Nuevo vuelo
        </Button>
      </div>
      {notice && (
        <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>{notice}</p>
          <button type="button" className="text-xs font-semibold underline" onClick={() => setNotice(null)}>
            Cerrar aviso
          </button>
        </div>
      )}
      <form onSubmit={apply} className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <Input label="Origen" placeholder="BOG" maxLength={3} value={draft.origen ?? ''} onChange={(e) => setDraft({ ...draft, origen: e.target.value })} />
        <Input label="Destino" placeholder="SCL" maxLength={3} value={draft.destino ?? ''} onChange={(e) => setDraft({ ...draft, destino: e.target.value })} />
        <Input label="Fecha de salida" type="date" value={draft.fecha ?? ''} onChange={(e) => setDraft({ ...draft, fecha: e.target.value })} />
        <Input label="N.º de vuelo" placeholder="LA800" maxLength={6} value={draft.vuelo ?? ''} onChange={(e) => setDraft({ ...draft, vuelo: e.target.value })} />
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

      <div role="region" tabIndex={0} aria-label="Tabla de vuelos, desplazable horizontalmente" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <caption className="sr-only">Vuelos programados</caption>
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Vuelo</th>
              <th scope="col" className="px-4 py-3">Ruta</th>
              <th scope="col" className="px-4 py-3">Salida (UTC)</th>
              <th scope="col" className="px-4 py-3">Aerolínea</th>
              <th scope="col" className="px-4 py-3 text-right">Tarifa base</th>
              <th scope="col" className="px-4 py-3 text-right">Libres</th>
              <th scope="col" className="px-4 py-3 text-right">Asiento elegido</th>
              <th scope="col" className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={8} className="p-4" role="status" aria-busy="true" aria-label="Cargando">
                  <Skeleton className="h-24 w-full" />
                </td>
              </tr>
            )}
            {flights.map((flight) => {
              const low = flight.asientosDisponibles <= Math.max(5, flight.capacidadTotal * 0.1);
              return (
                <tr key={flight.vueloId} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenFlight(flight)}>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-brand-black">
                    <button type="button" className="underline-offset-2 hover:underline" onClick={() => setOpenFlight(flight)} aria-label={`Ver asientos del vuelo ${flight.codigoVuelo}`}>
                      {flight.codigoVuelo}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    {flight.origen} → {flight.destino}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(flight.salida)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{flight.aerolinea}</td>
                  <td className="px-4 py-3 text-right">
                    <MoneyText amount={flight.precioBaseUsd.toFixed(2)} currency="USD" />
                  </td>
                  <td className={`px-4 py-3 text-right text-xs font-bold ${low ? 'text-red-600' : 'text-slate-700'}`}>
                    {flight.asientosDisponibles} / {flight.capacidadTotal}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">{flight.asientosReservados}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button type="button" size="sm" variant="outline" aria-label={`Editar vuelo ${flight.codigoVuelo}`} onClick={() => setAction({ kind: 'edit', flight })}>
                        Editar
                      </Button>
                      <Button type="button" size="sm" variant="outline" aria-label={`Reprogramar vuelo ${flight.codigoVuelo}`} onClick={() => setAction({ kind: 'reschedule', flight })}>
                        Reprogramar
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" aria-label={`Cancelar vuelo ${flight.codigoVuelo}`} onClick={() => setAction({ kind: 'cancel', flight })}>
                        Cancelar vuelo
                      </Button>
                      <Button type="button" size="sm" variant="danger" aria-label={`Eliminar vuelo ${flight.codigoVuelo}`} onClick={() => setAction({ kind: 'delete', flight })}>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && flights.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                  No hay vuelos con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasNextPage && (
        <div className="pt-5 text-center">
          <Button variant="outline" onClick={() => fetchNextPage()} isLoading={isFetchingNextPage}>
            Cargar más
          </Button>
        </div>
      )}

      <p className="mt-3 text-[11px] text-slate-500">Haz clic en un vuelo para ver su mapa de asientos y cuáles están reservados.</p>
      <CreateFlightDialog isOpen={creating} onClose={() => setCreating(false)} onDone={setNotice} />
      <EditFlightDialog flight={flightFor('edit')} onClose={closeAction} onDone={setNotice} />
      <RescheduleFlightDialog flight={flightFor('reschedule')} onClose={closeAction} onDone={setNotice} />
      <CancelFlightDialog flight={flightFor('cancel')} onClose={closeAction} onDone={setNotice} />
      <DeleteFlightDialog flight={flightFor('delete')} onClose={closeAction} onDone={setNotice} onSwitchToCancel={(flight) => setAction({ kind: 'cancel', flight })} />
      <FlightSeatsDialog flight={openFlight} ownerId={session?.ownerId} onClose={() => setOpenFlight(null)} />
    </section>
  );
};
