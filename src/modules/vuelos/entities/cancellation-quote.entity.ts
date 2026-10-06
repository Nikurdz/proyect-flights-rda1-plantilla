import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type CancellationQuoteStatus = 'OPEN' | 'USED';

/** What cancelling a booking would refund and retain at the moment of the quote; cancelling must cite it. */
@Entity('vuelos_cancellation_quotes')
@Index('IDX_vuelos_cancel_quotes_booking', ['bookingId'])
export class CancellationQuote {
  @PrimaryGeneratedColumn('uuid')
  quoteId: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  /** The fare rule: false when the fare family is not refundable (only the taxes come back). */
  @Column({ type: 'boolean' })
  isRefundable: boolean;

  @Column({ type: 'int' })
  refundMinor: number;

  @Column({ type: 'int' })
  penaltyMinor: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 10, default: 'OPEN' })
  status: CancellationQuoteStatus;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
