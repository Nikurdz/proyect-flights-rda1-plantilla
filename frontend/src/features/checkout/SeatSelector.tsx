import React, { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Armchair, X } from 'lucide-react';
import { useMapaAsientos } from '../../api/endpoints/offers';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tabs } from '../../components/ui/Tabs';
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

type Leg = OfertaViewDto['trayectos'][number];

interface LegSeatsProps {
  oferta: OfertaViewDto;
  leg: Leg;
  passengers: SeatPassenger[];
  value: SeatSelections;
  onChange: (next: SeatSelections) => void;
}

/** The seat map of one leg with the passenger picker above it. */
const LegSeats: React.FC<LegSeatsProps> = ({ oferta, leg, passengers, value, onChange }) => {
  const [activeId, setActiveId] = useState(passengers[0]?.id);
  const { data: map, isLoading, error, refetch } = useMapaAsientos(oferta.ofertaId, leg.itinerarioId);

  const ids = passengers.map((p) => p.id);
  const active = passengers.find((p) => p.id === activeId) ?? passengers[0];

  const picks = useMemo(() => {
    const out = new Map<string, SeatPick>();
    passengers.forEach((p, index) => {
      const seat = value[p.id]?.[leg.itinerarioId];
      if (seat) out.set(seat, { tag: String(index + 1), mine: p.id === active.id });
    });
    return out;
  }, [passengers, value, leg, active.id]);

  const select = (seat: string) => {
    const next = toggleSeat(value, active.id, leg.itinerarioId, seat);
    if (next === value) return;
    onChange(next);
    // After choosing (not clearing) move on to whoever still needs a seat on this leg.
    if (next[active.id]?.[leg.itinerarioId] === seat) {
      setActiveId(nextWithoutSeat(next, ids, leg.itinerarioId, active.id));
    }
  };

  const clear = (passengerId: string) => {
    const seat = value[passengerId]?.[leg.itinerarioId];
    if (seat) onChange(toggleSeat(value, passengerId, leg.itinerarioId, seat));
  };

  return (
    <div className="space-y-4 pt-4">
      <p className="text-small text-muted">
        Vuelo <strong className="num font-semibold text-ink">{leg.numeroVuelo}</strong>, de {leg.origen} a {leg.destino}
      </p>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pasajero que elige asiento">
        {passengers.map((p, index) => {
          const seat = value[p.id]?.[leg.itinerarioId];
          const isActive = p.id === active.id;
          return (
            <div key={p.id} className={clsx('flex items-center overflow-hidden rounded-lg border text-small', isActive ? 'border-gold-text bg-gold-soft' : 'border-line-strong bg-surface')}>
              <button type="button" role="radio" aria-checked={isActive} onClick={() => setActiveId(p.id)} className="flex min-h-[44px] items-center gap-2 px-3 py-2 font-medium text-ink sm:min-h-[36px]">
                <span className="num flex h-5 w-5 items-center justify-center rounded-full bg-ink text-xs font-semibold text-on-ink" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="max-w-[10rem] truncate">{p.label}</span>
                <span className={clsx('num text-xs', seat ? 'font-semibold text-gold-text' : 'text-muted')}>{seat ?? 'sin asiento'}</span>
              </button>
              {seat && (
                <button type="button" onClick={() => clear(p.id)} className="flex min-h-[44px] items-center border-l border-line px-2.5 text-muted hover:text-danger sm:min-h-[36px]" aria-label={`Quitar el asiento de ${p.label}`}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error != null ? (
        <ProblemAlert error={error} title="No pudimos cargar el mapa de asientos" onRetry={() => refetch()} />
      ) : isLoading || !map ? (
        <div role="status" aria-busy="true" aria-label="Cargando">
          <Skeleton className="mx-auto h-72 max-w-xs rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="max-h-[28rem] overflow-y-auto rounded-2xl">
            <SeatMap filas={map.filas} picks={picks} onSelect={select} />
          </div>
          <SeatLegend />
        </div>
      )}
    </div>
  );
};

/** Optional seat choice, one leg at a time; the picks live in the parent so they ride along with the passengers. */
export const SeatSelector: React.FC<SeatSelectorProps> = ({ oferta, passengers, value, onChange }) => {
  const legs = oferta.trayectos ?? [];
  if (legs.length === 0 || passengers.length === 0) return null;

  return (
    <Card className="p-5 sm:p-6" role="group" aria-labelledby="seat-selector-title">
      <div className="flex items-start gap-3 border-b border-line pb-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-gold-text" aria-hidden="true">
          <Armchair className="h-5 w-5" />
        </span>
        <div>
          <h2 id="seat-selector-title" className="text-lead font-semibold text-ink">
            Elige tus asientos <span className="text-body font-normal text-muted">(opcional)</span>
          </h2>
          <p className="mt-0.5 text-small text-muted">Sin costo adicional. Si no eliges, te asignamos uno en el check-in. El asiento queda confirmado al pagar.</p>
        </div>
      </div>

      {legs.length > 1 ? (
        <Tabs
          ariaLabel="Tramo del viaje"
          tabs={legs.map((leg, index) => ({
            id: leg.itinerarioId,
            label: `${index === 0 ? 'Ida' : 'Vuelta'}: ${leg.origen} a ${leg.destino}`,
            panel: <LegSeats oferta={oferta} leg={leg} passengers={passengers} value={value} onChange={onChange} />,
          }))}
          className="pt-3"
        />
      ) : (
        <LegSeats oferta={oferta} leg={legs[0]} passengers={passengers} value={value} onChange={onChange} />
      )}
    </Card>
  );
};
