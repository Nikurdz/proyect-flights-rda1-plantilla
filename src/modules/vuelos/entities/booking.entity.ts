import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type BookingStatus =
  | 'PENDING'
  | 'PENDING_PAYMENT'
  | 'TICKET_ISSUING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'CHANGE_PENDING'
  | 'CANCELLATION_PENDING'
  | 'CANCELLED';

@Entity('vuelos_bookings')
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

  // Decoded (never verified) from the Authorization header — see common/owner.util.ts.
  // No IdP exists in this phase; this is a documented placeholder.
  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  @Column({ type: 'varchar', length: 20 })
  grandTotal: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 100 })
  paymentReference: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
