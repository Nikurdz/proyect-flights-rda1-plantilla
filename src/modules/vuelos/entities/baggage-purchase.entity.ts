import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Booking } from './booking.entity';
import { Passenger } from './passenger.entity';
import { Vuelo } from './vuelo.entity';

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

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking?: Relation<Booking>;

  @Column({ type: 'uuid' })
  passengerId: string;

  @ManyToOne(() => Passenger, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'passengerId' })
  passenger?: Relation<Passenger>;

  @Column({ type: 'uuid' })
  itineraryId: string;

  @Column({ type: 'uuid' })
  vueloId: string;

  @ManyToOne(() => Vuelo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vueloId' })
  vuelo?: Relation<Vuelo>;

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
