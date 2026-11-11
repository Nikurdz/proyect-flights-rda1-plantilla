import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { bigintNumber } from '../common/bigint.transformer';
import type { PassengerBreakdown } from '../common/pricing.util';
import { FlightHoldItem } from './flight-hold-item.entity';
import { FlightOffer } from './flight-offer.entity';

export type HoldStatus = 'HELD' | 'RELEASED' | 'EXPIRED' | 'CONSUMED';

@Entity('vuelos_flight_holds')
@Index('IDX_vuelos_holds_status_expires', ['status', 'expiresAt'])
export class FlightHold {
  @PrimaryGeneratedColumn('uuid')
  holdId: string;

  @Column({ type: 'uuid' })
  offerId: string;

  // The cached search offer behind this hold. Stale offers are purged only when no hold points at them.
  @ManyToOne(() => FlightOffer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'offerId' })
  offer?: FlightOffer;

  // Verified `sub` of the caller that created the hold; only they may read or release it.
  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  @Column({ type: 'varchar', length: 20, default: 'HELD' })
  status: HoldStatus;

  @Column({ type: 'bigint', transformer: bigintNumber })
  lockedPriceMinor: number;

  // Taxes included in lockedPriceMinor, in minor units, frozen when the hold is created so a later change of
  // Vuelo.precioBase cannot move the refund of a non-refundable fare. Null on holds created before it existed.
  @Column({ type: 'int', nullable: true })
  lockedTaxesMinor: number | null;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'int' })
  ttlMinutes: number;

  @Column({ type: 'int' })
  adults: number;

  @Column({ type: 'int', default: 0 })
  youths: number;

  @Column({ type: 'int', default: 0 })
  children: number;

  @Column({ type: 'int', default: 0 })
  infants: number;

  // One row per leg: the flight, the fare and exactly the seats taken from that flight's inventory. Load them with
  // `findHold` (hold-loader.ts) — with a row lock a relation join is not allowed, so the items are read separately.
  @OneToMany(() => FlightHoldItem, (item) => item.hold, { cascade: true })
  items?: FlightHoldItem[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  private legs(): FlightHoldItem[] {
    if (!this.items) throw new Error(`Hold ${this.holdId}: items not loaded (use findHold / attachItems)`);
    return this.items;
  }

  /** What was taken from each flight's inventory, in leg order. */
  get inventory(): { vueloId: string; seats: number }[] {
    return this.legs().map((i) => ({ vueloId: i.vueloId, seats: i.seats }));
  }

  /** The fare chosen for each itinerary, in leg order (index-aligned with `inventory`). */
  get itinerarySelections(): { itineraryId: string; cabinClass: string; fareBrand: string }[] {
    return this.legs().map((i) => ({ itineraryId: i.itineraryId, cabinClass: i.cabinClass, fareBrand: i.fareBrand }));
  }

  get passengersBreakdown(): PassengerBreakdown {
    return { adults: this.adults, youths: this.youths, children: this.children, infants: this.infants };
  }
}
