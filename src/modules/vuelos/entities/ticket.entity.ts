import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type TicketStatus = 'PENDING' | 'ISSUING' | 'ISSUED' | 'FAILED' | 'VOIDED' | 'REFUNDED';

// One row per passenger for the whole itinerary — the direct-flights-only simplification
// means there is exactly one segment/coupon per ticket, so no separate coupon table.
@Entity('vuelos_tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  ticketId: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'uuid' })
  passengerId: string;

  @Column({ type: 'varchar', length: 13, unique: true })
  eTicketNumber: string;

  @Column({ type: 'varchar', length: 20, default: 'ISSUED' })
  status: TicketStatus;

  @Column({ type: 'timestamp' })
  issuedAt: Date;
}
