import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

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

  @Column({ type: 'uuid' })
  holdId: string;

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: BookingStatus;

  // Verified `sub` of the authenticated caller (see auth/jwt-auth.guard.ts).
  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  @Column({ type: 'varchar', length: 20 })
  grandTotal: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  // One payment can back at most one booking.
  @Column({ type: 'varchar', length: 100, unique: true })
  paymentReference: string;

  // Denormalised from the first flight so listings need no joins.
  @Column({ type: 'char', length: 3 })
  origin: string;

  @Column({ type: 'char', length: 3 })
  destination: string;

  @Column({ type: 'timestamptz' })
  departureAt: Date;

  // Millisecond precision so the (createdAt, bookingId) pagination cursor round-trips exactly.
  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt: Date;
}
