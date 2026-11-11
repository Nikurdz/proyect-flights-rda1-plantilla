import type { AsientoElegidoDto } from '../api/types';

/** Seats picked so far: passenger id -> leg id (trayectoId) -> seat number such as "12A". */
export type SeatSelections = Record<string, Record<string, string>>;

/** Who holds a seat on a leg, if anybody. */
export function seatHolder(selections: SeatSelections, trayectoId: string, seat: string): string | undefined {
  return Object.keys(selections).find((passengerId) => selections[passengerId]?.[trayectoId] === seat);
}

/**
 * Picks a seat for a passenger on a leg. Picking the seat they already hold clears it; a seat that
 * another passenger already holds is left alone (the map shows it as taken).
 */
export function toggleSeat(selections: SeatSelections, passengerId: string, trayectoId: string, seat: string): SeatSelections {
  const holder = seatHolder(selections, trayectoId, seat);
  if (holder && holder !== passengerId) return selections;

  const mine = { ...(selections[passengerId] ?? {}) };
  if (mine[trayectoId] === seat) {
    delete mine[trayectoId];
  } else {
    mine[trayectoId] = seat;
  }
  const next = { ...selections, [passengerId]: mine };
  if (Object.keys(mine).length === 0) delete next[passengerId];
  return next;
}

/** The passenger who should pick next on a leg: the first without a seat after the current one. */
export function nextWithoutSeat(selections: SeatSelections, passengerIds: string[], trayectoId: string, currentId: string): string {
  const start = passengerIds.indexOf(currentId);
  for (let step = 1; step <= passengerIds.length; step += 1) {
    const candidate = passengerIds[(start + step) % passengerIds.length];
    if (!selections[candidate]?.[trayectoId]) return candidate;
  }
  return currentId;
}

/** What the API takes for one passenger; undefined when no seat was picked (the field is optional). */
export function toAsientosPayload(selections: SeatSelections, passengerId: string): AsientoElegidoDto[] | undefined {
  const mine = selections[passengerId];
  if (!mine) return undefined;
  const list = Object.entries(mine).map(([trayectoId, asiento]) => ({ trayectoId, asiento }));
  return list.length > 0 ? list : undefined;
}

/** Rebuilds the picks from a saved offer, so coming back to the step keeps them. */
export function selectionsFromRegistered(pasajeros?: { id: string; asientos?: AsientoElegidoDto[] }[]): SeatSelections {
  const out: SeatSelections = {};
  for (const p of pasajeros ?? []) {
    if (!p.asientos?.length) continue;
    out[p.id] = Object.fromEntries(p.asientos.map((a) => [a.trayectoId, a.asiento]));
  }
  return out;
}

const TRAITS: Record<string, string> = {
  WINDOW: 'ventana',
  AISLE: 'pasillo',
  EXTRA_LEGROOM: 'más espacio para las piernas',
  EMERGENCY_EXIT: 'salida de emergencia',
};

/** Spanish description of a seat's characteristics, for tooltips and screen readers. */
export function seatTraits(characteristics: string[]): string {
  return characteristics.map((c) => TRAITS[c]).filter(Boolean).join(', ');
}
