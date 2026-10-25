import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, Unique } from 'typeorm';
import { Booking } from './booking.entity';
import { Passenger } from './passenger.entity';
import { Vuelo } from './vuelo.entity';

// A seat chosen at booking time. The unique (vueloId, seatNumber) constraint is what makes
// SEAT_TAKEN race-proof: two concurrent bookings cannot both persist the same seat.
@Entity('vuelos_seat_assignments')
@Unique('UQ_vuelos_seat_vuelo_numero', ['vueloId', 'seatNumber'])
export class SeatAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  vueloId: string;

  @ManyToOne(() => Vuelo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vueloId' })
  vuelo?: Relation<Vuelo>;

  @Column({ type: 'varchar', length: 4 })
  seatNumber: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking?: Relation<Booking>;

  @Column({ type: 'uuid' })
  passengerId: string;

  @ManyToOne(() => Passenger, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'passengerId' })
  passenger?: Relation<Passenger>;
}
