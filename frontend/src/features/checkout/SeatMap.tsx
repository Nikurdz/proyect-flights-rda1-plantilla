import React from 'react';
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
}

const LEFT = ['A', 'B', 'C'];
const RIGHT = ['D', 'E', 'F'];

/** Single-aisle economy cabin: A-B-C | D-E-F, one row per line. Pure presentation; the page owns the state. */
export const SeatMap: React.FC<SeatMapProps> = ({ filas, picks, onSelect }) => {
  const byColumn = (seats: MapaAsientosViewDto['filas'][number]['seats'], column: string) => seats.find((s) => s.seatNumber.endsWith(column));

  const renderSeat = (column: string, seats: MapaAsientosViewDto['filas'][number]['seats']) => {
    const seat = byColumn(seats, column);
    if (!seat) return <span key={column} className="h-9 w-9" aria-hidden="true" />; // last row can be short

    const pick = picks.get(seat.seatNumber);
    const traits = seatTraits(seat.characteristics);
    const extra = seat.characteristics.includes('EXTRA_LEGROOM') || seat.characteristics.includes('EMERGENCY_EXIT');
    const taken = !seat.isAvailable;

    let tone = 'border-slate-300 bg-white text-slate-700 hover:border-brand-gold hover:bg-brand-gold-light';
    if (extra) tone = 'border-brand-gold/60 bg-brand-gold-light/60 text-brand-gold-dark hover:border-brand-gold';
    if (taken) tone = 'cursor-not-allowed border-slate-200 bg-slate-200 text-slate-400';
    if (pick) tone = pick.mine ? 'border-brand-gold bg-brand-gold text-brand-black ring-2 ring-brand-gold/40' : 'border-brand-black bg-brand-black text-white';

    const state = pick ? (pick.mine ? 'elegido por ti' : `elegido (pasajero ${pick.tag})`) : taken ? 'ocupado' : 'disponible';
    return (
      <button
        key={column}
        type="button"
        disabled={taken && !pick}
        onClick={() => onSelect(seat.seatNumber)}
        title={`${seat.seatNumber}${traits ? ` · ${traits}` : ''}`}
        aria-label={`Asiento ${seat.seatNumber}, ${state}${traits ? `, ${traits}` : ''}`}
        aria-pressed={Boolean(pick?.mine)}
        className={`flex h-9 w-9 items-center justify-center rounded-lg border text-[11px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${tone}`}
      >
        {pick ? pick.tag : taken ? '×' : column}
      </button>
    );
  };

  return (
    <div className="mx-auto w-fit space-y-1.5 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-5 sm:px-8" role="group" aria-label="Mapa de asientos">
      <div className="flex items-center gap-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400" aria-hidden="true">
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
          <span className="w-6 text-right text-[10px] font-semibold text-slate-400" aria-hidden="true">
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
    <li className="flex items-center gap-1.5">
      <span className="h-4 w-4 rounded border border-slate-200 bg-slate-200" aria-hidden="true" />
      Ocupado
    </li>
  </ul>
);
