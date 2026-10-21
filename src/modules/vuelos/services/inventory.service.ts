import { HttpStatus, Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(InventoryService.name);

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

  /**
   * Gives seats back (hold released or expired), never beyond the aircraft capacity. Going beyond it means
   * the same seats were returned twice somewhere: the count is clamped, but it is logged instead of hidden.
   */
  async restore(manager: EntityManager, items: InventoryItem[]): Promise<void> {
    // tablePath carries the schema the connection is configured with (the test suites run in their own).
    const table = manager.connection.getMetadata(Vuelo).tablePath.split('.').map((part) => `"${part}"`).join('.');
    for (const item of [...items].sort((a, b) => a.vueloId.localeCompare(b.vueloId))) {
      if (item.seats <= 0) continue;
      const rows: { previous: number; current: number; capacity: number }[] = await manager.query(
        `UPDATE ${table} v
            SET "asientosDisponibles" = LEAST(o."asientosDisponibles" + $2, v."capacidadTotal")
           FROM (SELECT id, "asientosDisponibles" FROM ${table} WHERE id = $1 FOR UPDATE) o
          WHERE v.id = o.id
      RETURNING o."asientosDisponibles" AS previous, v."asientosDisponibles" AS current, v."capacidadTotal" AS capacity`,
        [item.vueloId, item.seats],
      );
      const [row] = Array.isArray(rows[0]) ? (rows[0] as unknown as typeof rows) : rows;
      if (row && row.previous + item.seats > row.capacity) {
        this.logger.warn(`Restore clamped on flight ${item.vueloId}: ${row.previous} + ${item.seats} exceeds capacity ${row.capacity} (seats returned twice?)`);
      }
    }
  }
}
