import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Booking } from './booking.entity';
import { Passenger } from './passenger.entity';

export type TicketStatus = 'PENDING' | 'ISSUING' | 'ISSUED' | 'FAILED' | 'VOIDED' | 'REFUNDED';

// One row per passenger for the whole itinerary — the direct-flights-only simplification
// means there is exactly one segment/coupon per ticket, so no separate coupon table.
@Entity('vuelos_tickets')
@Index('IDX_vuelos_tickets_booking', ['bookingId'])
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  ticketId: string;

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

  @Column({ type: 'varchar', length: 13, unique: true })
  eTicketNumber: string;

  @Column({ type: 'varchar', length: 20, default: 'ISSUED' })
  status: TicketStatus;

  @Column({ type: 'timestamp' })
  issuedAt: Date;
}
