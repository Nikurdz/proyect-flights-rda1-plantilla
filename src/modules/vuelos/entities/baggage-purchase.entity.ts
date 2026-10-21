import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Extra checked bags bought for one passenger on one leg of a booking, at booking time or afterwards.
 * `itineraryId` is the contract-facing id of the leg and `vueloId` the flight behind it. The payment
 * reference is the booking's own one when the bags are bought with the booking, and a new single-use one
 * afterwards (checked against bookings, baggage and date changes before it is accepted).
 */
@Entity('vuelos_baggage_purchases')
@Index('IDX_vuelos_baggage_booking', ['bookingId'])
export class BaggagePurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'uuid' })
  passengerId: string;

  @Column({ type: 'uuid' })
  itineraryId: string;

  @Column({ type: 'uuid' })
  vueloId: string;

  @Column({ type: 'int' })
  quantity: number;

  /** Minor units (cents) of one bag when it was bought. */
  @Column({ type: 'int' })
  unitPriceMinor: number;

  @Column({ type: 'int' })
  totalMinor: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Index('IDX_vuelos_baggage_payment')
  @Column({ type: 'varchar', length: 100 })
  paymentReference: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
