import { EntityManager, In } from 'typeorm';
import { FlightHold } from '../entities/flight-hold.entity';
import { FlightHoldSeat } from '../entities/flight-hold-seat.entity';
import { SeatAssignment } from '../entities/seat-assignment.entity';
import { seatTakenProblem } from './db-errors';
import { SeatRef, seatKey } from './seat-rules';

/**
 * Seats set aside by holds (`vuelos_flight_hold_seats`). A seat is HELD only while its hold is active: status
 * HELD and not past its expiry. The rows of a hold that ran out but was not swept yet hold nothing, so readers
 * ignore them and the next claim of that seat removes them.
 */
const isActive = (hold: FlightHold | undefined, now: number): boolean => !!hold && hold.status === 'HELD' && hold.expiresAt.getTime() > now;

const whereSeats = (seats: SeatRef[]) => seats.map((seat) => ({ vueloId: seat.segmentId, seatNumber: seat.seatNumber }));

/** The rows other holds have for these seats, each flagged with whether its hold is still active. */
async function rowsOfOtherHolds(manager: EntityManager, seats: SeatRef[], exceptHoldId?: string): Promise<{ row: FlightHoldSeat; active: boolean }[]> {
  if (seats.length === 0) return [];
  const rows = (await manager.find(FlightHoldSeat, { where: whereSeats(seats) })).filter((row) => row.holdId !== exceptHoldId);
  if (rows.length === 0) return [];
  const holds = await manager.find(FlightHold, { where: { holdId: In([...new Set(rows.map((row) => row.holdId))]) } });
  const now = Date.now();
  return rows.map((row) => ({ row, active: isActive(holds.find((hold) => hold.holdId === row.holdId), now) }));
}

/** The seat numbers of a flight that active holds have set aside; `exceptHoldId` leaves a hold's own seats out. */
export async function heldSeatNumbers(manager: EntityManager, vueloId: string, exceptHoldId?: string): Promise<Set<string>> {
  const rows = await manager
    .createQueryBuilder(FlightHoldSeat, 's')
    .innerJoin(FlightHold, 'h', 'h."holdId" = s."holdId"')
    .where('s."vueloId" = :vueloId AND h."status" = :held AND h."expiresAt" > :now', { vueloId, held: 'HELD', now: new Date() })
    .getMany();
  return new Set(rows.filter((row) => row.holdId !== exceptHoldId).map((row) => row.seatNumber));
}

/**
 * Ids of the ACTIVE holds (HELD, not past expiry) that have set aside any of these seats and belong to `ownerId`
 * for `offerId`: the previous attempt of the same purchase. Sorted, so callers lock them in a fixed order.
 */
export async function ownActiveHoldIdsWithSeats(manager: EntityManager, seats: SeatRef[], ownerId: string, offerId: string): Promise<string[]> {
  const rows = await rowsOfOtherHolds(manager, seats);
  const ids = [...new Set(rows.filter((entry) => entry.active).map((entry) => entry.row.holdId))];
  if (ids.length === 0) return [];
  const own = await manager.find(FlightHold, { where: { holdId: In(ids), ownerId, offerId } });
  return own.map((hold) => hold.holdId).sort();
}

/** The first of these seats that ANOTHER active hold has set aside, if any. */
export async function seatHeldByAnotherHold(manager: EntityManager, seats: SeatRef[], exceptHoldId?: string): Promise<SeatRef | null> {
  const taken = (await rowsOfOtherHolds(manager, seats, exceptHoldId)).find((entry) => entry.active);
  return taken ? { segmentId: taken.row.vueloId, seatNumber: taken.row.seatNumber } : null;
}

/** 409 SEAT_TAKEN when another active hold has one of these seats. */
export async function assertNotHeldByAnotherHold(manager: EntityManager, seats: SeatRef[], exceptHoldId?: string): Promise<void> {
  const taken = await seatHeldByAnotherHold(manager, seats, exceptHoldId);
  if (taken) throw seatTakenProblem(taken.seatNumber, taken.segmentId);
}

/**
 * Serialises, until the transaction ends, everyone that is about to take one of these seats — by holding it or by
 * selling it. Sold seats and held seats live in two tables, each with its own unique index, so without this a
 * booking and a hold could both pass their checks and take the same seat at the same moment. Keys are locked in a
 * fixed order so two requests for the same seats cannot deadlock. Must run inside a transaction.
 */
export async function lockSeats(manager: EntityManager, seats: SeatRef[]): Promise<void> {
  const keys = [...new Set(seats.map(seatKey))].sort();
  for (const key of keys) {
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`vuelos-seat:${key}`]);
  }
}

/**
 * Sets seats aside for a hold, inside the caller's transaction. A seat already sold or held by another active
 * hold answers 409 SEAT_TAKEN naming it. The insert is `ON CONFLICT DO NOTHING`: losing a race for the unique
 * (flight, seat) index inserts fewer rows instead of raising an error, so the transaction is not left aborted and
 * the caller gets the typed problem (throwing it rolls back whatever the caller did, e.g. the inventory it took).
 */
export async function claimHoldSeats(manager: EntityManager, holdId: string, seats: SeatRef[]): Promise<void> {
  if (seats.length === 0) return;
  await lockSeats(manager, seats);

  const sold = await manager.find(SeatAssignment, { where: whereSeats(seats) });
  if (sold.length > 0) throw seatTakenProblem(sold[0].seatNumber, sold[0].vueloId);

  const others = await rowsOfOtherHolds(manager, seats, holdId);
  const active = others.find((entry) => entry.active);
  if (active) throw seatTakenProblem(active.row.seatNumber, active.row.vueloId);
  // What is left belongs to holds that ran out and were not swept yet: they hold nothing any more.
  const stale = others.map((entry) => entry.row.id);
  if (stale.length > 0) await manager.delete(FlightHoldSeat, { id: In(stale) });

  const inserted = await manager
    .createQueryBuilder()
    .insert()
    .into(FlightHoldSeat)
    .values(seats.map((seat) => ({ holdId, vueloId: seat.segmentId, seatNumber: seat.seatNumber })))
    .orIgnore()
    .returning(['vueloId', 'seatNumber'])
    .updateEntity(false)
    .execute();
  const got = new Set((inserted.raw as { vueloId: string; seatNumber: string }[]).map((row) => seatKey({ segmentId: row.vueloId, seatNumber: row.seatNumber })));
  const lost = seats.find((seat) => !got.has(seatKey(seat)));
  if (lost) throw seatTakenProblem(lost.seatNumber, lost.segmentId);
}

/** Gives back every seat a hold had set aside (the hold was released, expired or turned into a booking). */
export async function releaseHoldSeats(manager: EntityManager, holdId: string): Promise<void> {
  await manager.delete(FlightHoldSeat, { holdId });
}
