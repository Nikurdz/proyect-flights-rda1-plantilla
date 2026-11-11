import React from 'react';
import { Clock3 } from 'lucide-react';
import type { MapaAsientosViewDto } from '../../api/types';
import { seatTraits } from '../../lib/seats';

export interface SeatPick {
  /** Short tag shown on the seat, e.g. the passenger's number. */
  tag: string;
  /** True when the pick belongs to the passenger who is choosing right now. */
  mine: boolean;
}

interface SeatMapProps {
  filas: MapaAsientosViewDto['filas'];
  picks: Map<string, SeatPick>;
  onSelect: (seatNumber: string) => void;
  /** Optional note per taken seat (e.g. the booking that holds it), shown as its tooltip; used by the back office. */
  takenInfo?: Map<string, string>;
}

const LEFT = ['A', 'B', 'C'];
const RIGHT = ['D', 'E', 'F'];

/**
 * A seat another customer has set aside while they pay. It is told apart from an occupied seat by more than
 * colour: a dashed border, a diagonal hatch and a clock instead of the solid grey cross.
 */
const HELD_TONE = 'cursor-not-allowed border-dashed border-slate-400 text-slate-500 bg-[repeating-linear-gradient(135deg,#ffffff_0,#ffffff_3px,#e2e8f0_3px,#e2e8f0_5px)]';

/** Single-aisle economy cabin: A-B-C | D-E-F, one row per line. Pure presentation; the page owns the state. */
export const SeatMap: React.FC<SeatMapProps> = ({ filas, picks, onSelect, takenInfo }) => {
  const byColumn = (seats: MapaAsientosViewDto['filas'][number]['seats'], column: string) => seats.find((s) => s.seatNumber.endsWith(column));

  const renderSeat = (column: string, seats: MapaAsientosViewDto['filas'][number]['seats']) => {
    const seat = byColumn(seats, column);
    if (!seat) return <span key={column} className="h-9 w-9" aria-hidden="true" />; // last row can be short

    const pick = picks.get(seat.seatNumber);
    const traits = seatTraits(seat.characteristics);
    const extra = seat.characteristics.includes('EXTRA_LEGROOM') || seat.characteristics.includes('EMERGENCY_EXIT');
    const taken = !seat.isAvailable;
    const held = taken && seat.status === 'HELD';

    let tone = 'border-slate-300 bg-white text-slate-700 hover:border-brand-gold hover:bg-brand-gold-light';
    if (extra) tone = 'border-brand-gold/60 bg-brand-gold-light/60 text-brand-gold-dark hover:border-brand-gold';
    if (taken) tone = held ? HELD_TONE : 'cursor-not-allowed border-slate-200 bg-slate-200 text-slate-400';
    if (pick) tone = pick.mine ? 'border-brand-gold bg-brand-gold text-brand-black ring-2 ring-brand-gold/40' : 'border-brand-black bg-brand-black text-white';

    const holder = takenInfo?.get(seat.seatNumber);
    const state = pick ? (pick.mine ? 'elegido por ti' : `elegido (pasajero ${pick.tag})`) : taken ? (holder ? `reservado (${holder})` : held ? 'apartado por otro cliente' : 'ocupado') : 'disponible';
    return (
      <button
        key={column}
        type="button"
        disabled={taken && !pick}
        onClick={() => onSelect(seat.seatNumber)}
        title={`${seat.seatNumber}${traits ? ` · ${traits}` : ''}${holder ? ` · ${holder}` : held && !pick ? ' · apartado por otro cliente' : ''}`}
        aria-label={`Asiento ${seat.seatNumber}, ${state}${traits ? `, ${traits}` : ''}`}
        aria-pressed={Boolean(pick?.mine)}
        className={`flex h-9 w-9 items-center justify-center rounded-lg border text-[11px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${tone}`}
      >
        {pick ? pick.tag : held ? <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> : taken ? '×' : column}
      </button>
    );
  };

  return (
    <div className="mx-auto w-fit space-y-1.5 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-5 sm:px-8" role="group" aria-label="Mapa de asientos">
      <div className="flex items-center gap-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500" aria-hidden="true">
        <span className="w-6" />
        {LEFT.map((c) => (
          <span key={c} className="w-9 text-center">
            {c}
          </span>
        ))}
        <span className="w-6" />
        {RIGHT.map((c) => (
          <span key={c} className="w-9 text-center">
            {c}
          </span>
        ))}
      </div>

      {filas.map((fila) => (
        <div key={fila.rowNumber} className="flex items-center gap-1.5">
          <span className="w-6 text-right text-[10px] font-semibold text-slate-500" aria-hidden="true">
            {fila.rowNumber}
          </span>
          {LEFT.map((column) => renderSeat(column, fila.seats))}
          <span className="w-6" aria-hidden="true" />
          {RIGHT.map((column) => renderSeat(column, fila.seats))}
        </div>
      ))}
    </div>
  );
};

/** Colour key shown under the map. */
export const SeatLegend: React.FC = () => (
  <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-slate-600">
    <li className="flex items-center gap-1.5">
      <span className="h-4 w-4 rounded border border-slate-300 bg-white" aria-hidden="true" />
      Disponible
    </li>
    <li className="flex items-center gap-1.5">
      <span className="h-4 w-4 rounded border border-brand-gold/60 bg-brand-gold-light/60" aria-hidden="true" />
      Más espacio / salida de emergencia
    </li>
    <li className="flex items-center gap-1.5">
      <span className="h-4 w-4 rounded border border-brand-gold bg-brand-gold" aria-hidden="true" />
      Tu elección
    </li>
    <li className="flex items-center gap-1.5">
      <span className="h-4 w-4 rounded border border-brand-black bg-brand-black" aria-hidden="true" />
      Otro pasajero tuyo
    </li>
    <li className="flex items-center gap-1.5" title="Otro cliente lo está comprando; puede volver a quedar disponible">
      <span
        className="flex h-4 w-4 items-center justify-center rounded border border-dashed border-slate-400 bg-[repeating-linear-gradient(135deg,#ffffff_0,#ffffff_3px,#e2e8f0_3px,#e2e8f0_5px)]"
        aria-hidden="true"
      />
      Apartado
    </li>
    <li className="flex items-center gap-1.5">
      <span className="h-4 w-4 rounded border border-slate-200 bg-slate-200" aria-hidden="true" />
      Ocupado
    </li>
  </ul>
);
