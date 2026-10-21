import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

// A seat chosen at booking time. The unique (vueloId, seatNumber) constraint is what makes
// SEAT_TAKEN race-proof: two concurrent bookings cannot both persist the same seat.
@Entity('vuelos_seat_assignments')
@Unique('UQ_vuelos_seat_vuelo_numero', ['vueloId', 'seatNumber'])
export class SeatAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  vueloId: string;

  @Column({ type: 'varchar', length: 4 })
  seatNumber: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'uuid' })
  passengerId: string;
}
