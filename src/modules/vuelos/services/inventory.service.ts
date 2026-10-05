import { HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { Vuelo } from '../entities/vuelo.entity';

export interface InventoryItem {
  vueloId: string;
  seats: number;
}

/**
 * The only writer of Vuelo.asientosDisponibles. Every change is a single conditional UPDATE,
 * so concurrent holds cannot oversell: the database arbitrates, not application code that
 * read a stale count.
 */
@Injectable()
export class InventoryService {
  /** Takes seats from every flight or throws SEAT_TAKEN (the caller's transaction rolls back). */
  async reserve(manager: EntityManager, items: InventoryItem[]): Promise<void> {
    // Fixed order (by id) so two holds touching the same flights cannot deadlock each other.
    for (const item of [...items].sort((a, b) => a.vueloId.localeCompare(b.vueloId))) {
      if (item.seats <= 0) continue;
      const result = await manager
        .createQueryBuilder()
        .update(Vuelo)
        .set({ asientosDisponibles: () => '"asientosDisponibles" - :seats' })
        .where('id = :id AND "asientosDisponibles" >= :seats', { id: item.vueloId, seats: item.seats })
        .execute();

      if (result.affected !== 1) {
        throw new ProblemDetailsException(
          HttpStatus.CONFLICT,
          'SEAT_TAKEN',
          'Not enough seats available',
          `Flight ${item.vueloId} no longer has ${item.seats} seat(s) available.`,
        );
      }
    }
  }

  /** Gives seats back (hold released or expired), never beyond the aircraft capacity. */
  async restore(manager: EntityManager, items: InventoryItem[]): Promise<void> {
    for (const item of [...items].sort((a, b) => a.vueloId.localeCompare(b.vueloId))) {
      if (item.seats <= 0) continue;
      await manager
        .createQueryBuilder()
        .update(Vuelo)
        .set({ asientosDisponibles: () => 'LEAST("asientosDisponibles" + :seats, "capacidadTotal")' })
        .where('id = :id', { id: item.vueloId, seats: item.seats })
        .setParameter('seats', item.seats)
        .execute();
    }
  }
}
