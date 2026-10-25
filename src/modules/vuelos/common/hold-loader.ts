import type { EntityManager } from 'typeorm';
import { FlightHold } from '../entities/flight-hold.entity';
import { FlightHoldItem } from '../entities/flight-hold-item.entity';

export interface FindHoldOptions {
  /** Row lock on the hold (booking, release, expiry). The items are read afterwards: a join cannot be locked. */
  lock?: boolean;
}

/** Reads the legs of a hold, in order, and attaches them (`hold.items`) so `inventory` / `itinerarySelections` work. */
export async function attachItems(manager: EntityManager, hold: FlightHold): Promise<FlightHold> {
  hold.items = await manager.find(FlightHoldItem, { where: { holdId: hold.holdId }, order: { orden: 'ASC' } });
  return hold;
}

/** Same for several holds with one query. */
export async function attachItemsToMany(manager: EntityManager, holds: FlightHold[]): Promise<FlightHold[]> {
  if (holds.length === 0) return holds;
  const rows = await manager
    .createQueryBuilder(FlightHoldItem, 'i')
    .where('i."holdId" IN (:...ids)', { ids: holds.map((h) => h.holdId) })
    .orderBy('i."orden"', 'ASC')
    .getMany();
  for (const hold of holds) hold.items = rows.filter((row) => row.holdId === hold.holdId);
  return holds;
}

/** Loads one hold with its items; null when it does not exist. */
export async function findHold(manager: EntityManager, holdId: string, options: FindHoldOptions = {}): Promise<FlightHold | null> {
  const hold = await manager.findOne(FlightHold, { where: { holdId }, ...(options.lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
  return hold ? attachItems(manager, hold) : null;
}
