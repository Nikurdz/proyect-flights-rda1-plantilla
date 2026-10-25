import { Column, CreateDateColumn, Entity, Index, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bigintNumber } from '../common/bigint.transformer';
import { BookingCambio } from './booking-cambio.entity';
import { FlightHold } from './flight-hold.entity';

export type BookingStatus =
  | 'PENDING'
  | 'PENDING_PAYMENT'
  | 'TICKET_ISSUING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'CHANGE_PENDING'
  | 'CANCELLATION_PENDING'
  | 'CANCELLED';

export const BOOKING_STATUSES: BookingStatus[] = [
  'PENDING',
  'PENDING_PAYMENT',
  'TICKET_ISSUING',
  'CONFIRMED',
  'FAILED',
  'CHANGE_PENDING',
  'CANCELLATION_PENDING',
  'CANCELLED',
];

@Entity('vuelos_bookings')
@Index('IDX_vuelos_bookings_owner_created', ['ownerId', 'createdAt', 'bookingId'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  bookingId: string;

  // Six-character alphanumeric locator, per the SRS's PNR definition.
  @Column({ type: 'varchar', length: 6, unique: true })
  pnr: string;

  // The hold this booking consumed: it also holds the booking's legs (flights, fares, seats), so the route is not copied here.
  @Column({ type: 'uuid', unique: true })
  holdId: string;

  @OneToOne(() => FlightHold, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'holdId' })
  hold?: FlightHold;

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: BookingStatus;

  // Verified `sub` of the authenticated caller (see auth/jwt-auth.guard.ts).
  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  @Column({ type: 'bigint', transformer: bigintNumber })
  totalMinor: number;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  // One payment can back at most one booking.
  @Column({ type: 'varchar', length: 100, unique: true })
  paymentReference: string;

  // Millisecond precision so the (createdAt, bookingId) pagination cursor round-trips exactly.
  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt: Date;

  // History shown in BookingDetail.changes (date changes, flight reschedules, cancellation), one row per change.
  @OneToMany(() => BookingCambio, (cambio) => cambio.booking, { cascade: true })
  cambios?: BookingCambio[];
}
