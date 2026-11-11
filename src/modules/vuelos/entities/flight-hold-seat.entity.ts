import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, Unique } from 'typeorm';
import { FlightHold } from './flight-hold.entity';
import { Vuelo } from './vuelo.entity';

/**
 * A seat set aside by a hold (`assignedSeats` of POST /offers/hold, or the seats a web customer picked for the
 * offer). Rows exist only while the hold is HELD: releasing, expiring or consuming the hold deletes them, and the
 * booking writes the sold seats to `vuelos_seat_assignments`. The unique (vueloId, seatNumber) constraint is what
 * makes two concurrent holds for one seat impossible, as it does for sold seats.
 * Constraint names are explicit so the hand-written migration and the entity can never drift.
 */
@Entity('vuelos_flight_hold_seats')
@Unique('UQ_hold_seat_vuelo_numero', ['vueloId', 'seatNumber'])
@Index('IDX_hold_seat_hold', ['holdId'])
export class FlightHoldSeat {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_vuelos_flight_hold_seats' })
  id: string;

  @Column({ type: 'uuid' })
  holdId: string;

  @ManyToOne(() => FlightHold, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'holdId', foreignKeyConstraintName: 'FK_hold_seat_hold' })
  hold?: Relation<FlightHold>;

  @Column({ type: 'uuid' })
  vueloId: string;

  @ManyToOne(() => Vuelo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vueloId', foreignKeyConstraintName: 'FK_hold_seat_vuelo' })
  vuelo?: Relation<Vuelo>;

  @Column({ type: 'varchar', length: 4 })
  seatNumber: string;
}
