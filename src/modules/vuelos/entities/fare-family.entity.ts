import { Column, Entity, PrimaryColumn } from 'typeorm';

// SRS §3.4 — economy-only fare families for this phase (Basic/Light/Full).
// Premium Economy/Business families are a documented gap, not implemented yet.
@Entity('vuelos_fare_families')
export class FareFamily {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'int' })
  carryOnKg: number;

  @Column({ type: 'int' })
  checkedBags: number;

  @Column({ type: 'boolean' })
  changeable: boolean;

  @Column({ type: 'boolean' })
  refundable: boolean;

  @Column({ type: 'boolean' })
  seatSelectionIncluded: boolean;

  @Column({ type: 'boolean' })
  upgradeEligible: boolean;

  // RN-11: the most restrictive economy family accrues at a reduced factor.
  @Column({ type: 'float' })
  accrualFactor: number;

  // Applied to Vuelo.precioBase to derive this family's base fare — a stand-in for a
  // real tariff engine (there is none in this phase).
  @Column({ type: 'float' })
  priceMultiplier: number;
}
