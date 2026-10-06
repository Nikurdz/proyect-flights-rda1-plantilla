import React, { useState } from 'react';
import { useAdminVuelos, type AdminFlightsFilters } from '../../api/endpoints/admin';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDateTime } from '../../lib/labels';
import { useSession } from '../../lib/session';

export const AdminFlightsPage: React.FC = () => {
  const session = useSession();
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

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Vuelo</th>
              <th className="px-4 py-3">Ruta</th>
              <th className="px-4 py-3">Salida (UTC)</th>
              <th className="px-4 py-3">Aerolínea</th>
              <th className="px-4 py-3 text-right">Tarifa base</th>
              <th className="px-4 py-3 text-right">Asientos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="p-4">
                  <Skeleton className="h-24 w-full" />
                </td>
              </tr>
            )}
            {flights.map((flight) => {
              const low = flight.asientosDisponibles <= Math.max(5, flight.capacidadTotal * 0.1);
              return (
                <tr key={flight.vueloId}>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-brand-black">{flight.codigoVuelo}</td>
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
                </tr>
              );
            })}
            {!isLoading && flights.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
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
    </section>
  );
};
