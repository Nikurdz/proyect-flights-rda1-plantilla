import React, { useMemo, useState } from 'react';
import { Armchair, X } from 'lucide-react';
import { useMapaAsientos } from '../../api/endpoints/offers';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Skeleton } from '../../components/ui/Skeleton';
import { nextWithoutSeat, toggleSeat, type SeatSelections } from '../../lib/seats';
import type { OfertaViewDto } from '../../api/types';
import { SeatLegend, SeatMap, type SeatPick } from './SeatMap';

export interface SeatPassenger {
  id: string;
  /** What the traveller sees: their name once typed, otherwise "Pasajero 1". */
  label: string;
}

interface SeatSelectorProps {
  oferta: OfertaViewDto;
  /** Only passengers who take a seat (lap infants are left out by the caller). */
  passengers: SeatPassenger[];
  value: SeatSelections;
  onChange: (next: SeatSelections) => void;
}

/** Optional seat choice, one leg at a time; the picks live in the parent so they ride along with the passengers. */
export const SeatSelector: React.FC<SeatSelectorProps> = ({ oferta, passengers, value, onChange }) => {
  const legs = oferta.trayectos ?? [];
  const [legId, setLegId] = useState(legs[0]?.itinerarioId);
  const [activeId, setActiveId] = useState(passengers[0]?.id);

  const leg = legs.find((l) => l.itinerarioId === legId) ?? legs[0];
  const { data: map, isLoading, error, refetch } = useMapaAsientos(oferta.ofertaId, leg?.itinerarioId);

  const ids = passengers.map((p) => p.id);
  const active = passengers.find((p) => p.id === activeId) ?? passengers[0];

  const picks = useMemo(() => {
    const out = new Map<string, SeatPick>();
    if (!leg) return out;
    passengers.forEach((p, index) => {
      const seat = value[p.id]?.[leg.itinerarioId];
      if (seat) out.set(seat, { tag: String(index + 1), mine: p.id === active?.id });
    });
    return out;
  }, [passengers, value, leg, active?.id]);

  if (!leg || passengers.length === 0) return null;

  const select = (seat: string) => {
    const next = toggleSeat(value, active.id, leg.itinerarioId, seat);
    if (next === value) return;
    onChange(next);
    // After choosing (not clearing) move on to whoever still needs a seat on this leg.
    if (next[active.id]?.[leg.itinerarioId] === seat) {
      setActiveId(nextWithoutSeat(next, ids, leg.itinerarioId, active.id));
    }
  };

  const clear = (passengerId: string, trayectoId: string) => {
    const seat = value[passengerId]?.[trayectoId];
    if (seat) onChange(toggleSeat(value, passengerId, trayectoId, seat));
  };

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm" aria-labelledby="seat-selector-title">
      <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
        <Armchair className="mt-0.5 h-5 w-5 text-brand-gold-dark" aria-hidden="true" />
        <div>
          <h3 id="seat-selector-title" className="text-sm font-bold text-slate-900">
            Elige tus asientos <span className="font-medium text-slate-400">(opcional)</span>
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Sin costo adicional en este prototipo. Si no eliges, te asignamos uno al hacer el check-in. El asiento queda confirmado al pagar.
          </p>
        </div>
      </div>

      {legs.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Trayecto">
          {legs.map((l, index) => (
            <button
              key={l.itinerarioId}
              type="button"
              role="tab"
              id={`seat-tab-${l.itinerarioId}`}
              aria-controls="seat-tabpanel"
              aria-selected={l.itinerarioId === leg.itinerarioId}
              onClick={() => setLegId(l.itinerarioId)}
              className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-colors ${
                l.itinerarioId === leg.itinerarioId ? 'border-brand-black bg-brand-black text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-gold'
              }`}
            >
              {index === 0 ? 'Ida' : 'Vuelta'} · {l.origen} → {l.destino}
            </button>
          ))}
        </div>
      )}
      <div role={legs.length > 1 ? 'tabpanel' : undefined} id="seat-tabpanel" aria-labelledby={legs.length > 1 ? `seat-tab-${leg.itinerarioId}` : undefined} className="space-y-4">
      <p className="text-xs text-slate-500">
        Vuelo <strong className="font-mono text-slate-800">{leg.numeroVuelo}</strong> · {leg.origen} → {leg.destino}
      </p>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pasajero que elige asiento">
        {passengers.map((p, index) => {
          const seat = value[p.id]?.[leg.itinerarioId];
          const isActive = p.id === active.id;
          return (
            <div key={p.id} className={`flex items-center overflow-hidden rounded-xl border text-xs ${isActive ? 'border-brand-gold bg-brand-gold-light' : 'border-slate-200 bg-white'}`}>
              <button type="button" role="radio" aria-checked={isActive} onClick={() => setActiveId(p.id)} className="flex items-center gap-2 px-3 py-2 font-semibold text-slate-800">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-black text-[10px] font-bold text-white">{index + 1}</span>
                <span className="max-w-[10rem] truncate">{p.label}</span>
                <span className={`font-mono text-[11px] ${seat ? 'text-brand-gold-dark' : 'text-slate-400'}`}>{seat ?? 'sin asiento'}</span>
              </button>
              {seat && (
                <button type="button" onClick={() => clear(p.id, leg.itinerarioId)} className="border-l border-slate-200 px-2 py-2 text-slate-400 hover:text-red-600" aria-label={`Quitar el asiento de ${p.label}`}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error != null ? (
        <ProblemAlert error={error} title="No pudimos cargar el mapa de asientos" onRetry={() => refetch()} />
      ) : isLoading || !map ? (
        <div role="status" aria-busy="true" aria-label="Cargando"><Skeleton className="mx-auto h-72 max-w-xs rounded-3xl" /></div>
      ) : (
        <div className="space-y-4">
          <div className="max-h-[28rem] overflow-y-auto rounded-3xl">
            <SeatMap filas={map.filas} picks={picks} onSelect={select} />
          </div>
          <SeatLegend />
        </div>
      )}
      </div>
    </section>
  );
};
