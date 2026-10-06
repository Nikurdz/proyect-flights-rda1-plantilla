import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ChangeOfferStatus = 'OPEN' | 'USED';

/**
 * A priced option to move one leg of a booking to another flight on the same route. The contract has no
 * GET for it, so confirming a change resolves the offer id against this table (like a hold resolves a
 * search offer). Differences are signed minor units: a cheaper flight gives a negative fare difference that
 * is never refunded (the amount to pay is clamped at the fee).
 */
@Entity('vuelos_date_change_offers')
@Index('IDX_vuelos_change_offers_booking', ['bookingId'])
export class DateChangeOffer {
  @PrimaryGeneratedColumn('uuid')
  changeOfferId: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  /** Contract-facing id of the leg being moved. */
  @Column({ type: 'uuid' })
  itineraryId: string;

  @Column({ type: 'uuid' })
  fromVueloId: string;

  @Column({ type: 'uuid' })
  toVueloId: string;

  @Column({ type: 'int' })
  fareDifferenceMinor: number;

  @Column({ type: 'int' })
  taxDifferenceMinor: number;

  @Column({ type: 'int' })
  changeFeeMinor: number;

  @Column({ type: 'int' })
  totalToPayMinor: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 10, default: 'OPEN' })
  status: ChangeOfferStatus;

  // The single-use payment that covered the change, set when the offer is confirmed.
  @Column({ type: 'varchar', length: 100, nullable: true })
  paymentReference: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
