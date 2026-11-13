import React from 'react';
import { Clock3 } from 'lucide-react';
import type { MapaAsientosViewDto } from '../../api/types';
import { seatTraits } from '../../lib/seats';
import { SEAT_TONES } from './seat-tones';

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

    let tone: string = SEAT_TONES.free;
    if (extra) tone = SEAT_TONES.extra;
    if (taken) tone = held ? SEAT_TONES.held : SEAT_TONES.taken;
    if (pick) tone = pick.mine ? SEAT_TONES.mine : SEAT_TONES.other;

    const holder = takenInfo?.get(seat.seatNumber);
    const state = pick ? (pick.mine ? 'tu elección' : `elegido (pasajero ${pick.tag})`) : taken ? (holder ? `reservado (${holder})` : held ? 'apartado por otro cliente' : 'ocupado') : 'libre';
    return (
      <button
        key={column}
        type="button"
        disabled={taken && !pick}
        onClick={() => onSelect(seat.seatNumber)}
        title={`${seat.seatNumber}${traits ? ` · ${traits}` : ''}${holder ? ` · ${holder}` : held && !pick ? ' · apartado por otro cliente' : ''}`}
        aria-label={`Asiento ${seat.seatNumber}, ${state}${traits ? `, ${traits}` : ''}`}
        aria-pressed={Boolean(pick?.mine)}
        className={`num flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${tone}`}
      >
        {pick ? pick.tag : held ? <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> : taken ? '×' : column}
      </button>
    );
  };

  return (
    <div className="mx-auto w-fit space-y-1.5 rounded-2xl border border-line bg-paper px-4 py-5 sm:px-8" role="group" aria-label="Mapa de asientos">
      <div className="flex items-center gap-1.5 pb-1 text-xs font-medium text-muted" aria-hidden="true">
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
          <span className="num w-6 text-right text-xs text-muted" aria-hidden="true">
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

/** Key shown under the map: every state has a swatch and a word, never color alone. */
export const SeatLegend: React.FC = () => {
  const swatch = 'flex h-5 w-5 items-center justify-center rounded border';
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted" aria-label="Significado de los asientos">
      <li className="flex items-center gap-1.5">
        <span className={`${swatch} ${SEAT_TONES.free}`} aria-hidden="true" />
        Libre
      </li>
      <li className="flex items-center gap-1.5">
        <span className={`${swatch} ${SEAT_TONES.extra}`} aria-hidden="true" />
        Más espacio o salida de emergencia
      </li>
      <li className="flex items-center gap-1.5">
        <span className={`${swatch} ${SEAT_TONES.mine}`} aria-hidden="true" />
        Tu elección
      </li>
      <li className="flex items-center gap-1.5">
        <span className={`${swatch} ${SEAT_TONES.other}`} aria-hidden="true" />
        Otro pasajero tuyo
      </li>
      <li className="flex items-center gap-1.5" title="Otro cliente lo está comprando; puede volver a quedar libre">
        <span className={`${swatch} ${SEAT_TONES.held}`} aria-hidden="true">
          <Clock3 className="h-3 w-3" />
        </span>
        Apartado
      </li>
      <li className="flex items-center gap-1.5">
        <span className={`${swatch} ${SEAT_TONES.taken}`} aria-hidden="true">
          ×
        </span>
        Ocupado
      </li>
    </ul>
  );
};
