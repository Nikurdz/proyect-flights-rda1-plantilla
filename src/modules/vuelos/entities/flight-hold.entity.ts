import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type HoldStatus = 'HELD' | 'RELEASED' | 'EXPIRED' | 'CONSUMED';

@Entity('vuelos_flight_holds')
@Index('IDX_vuelos_holds_status_expires', ['status', 'expiresAt'])
export class FlightHold {
  @PrimaryGeneratedColumn('uuid')
  holdId: string;

  @Column({ type: 'uuid' })
  offerId: string;

  // Verified `sub` of the caller that created the hold; only they may read or release it.
  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  @Column({ type: 'varchar', length: 20, default: 'HELD' })
  status: HoldStatus;

  @Column({ type: 'varchar', length: 20 })
  lockedPrice: string;

  // Taxes included in lockedPrice, in minor units, frozen when the hold is created so a later change of
  // Vuelo.precioBase cannot move the refund of a non-refundable fare. Null on holds created before it existed.
  @Column({ type: 'int', nullable: true })
  lockedTaxesMinor: number | null;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'int' })
  ttlMinutes: number;

  @Column({ type: 'jsonb' })
  itinerarySelections: { itineraryId: string; cabinClass: string; fareBrand: string }[];

  @Column({ type: 'jsonb' })
  passengersBreakdown: {
    adults: number;
    youths: number;
    children: number;
    infants: number;
  };

  // Exactly what was taken from each flight's inventory, so releasing/expiring the hold
  // restores precisely that and never a recomputed figure.
  @Column({ type: 'jsonb' })
  inventory: { vueloId: string; seats: number }[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;
}
