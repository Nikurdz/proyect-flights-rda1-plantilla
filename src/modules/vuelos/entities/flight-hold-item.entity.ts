import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { FareFamily } from './fare-family.entity';
import { FlightHold } from './flight-hold.entity';
import { Vuelo } from './vuelo.entity';

/**
 * One leg of a hold: which flight, which fare and exactly how many seats were taken from that flight's inventory,
 * so releasing or expiring the hold restores precisely that. A booking's legs ARE its hold's items (a date change
 * moves `vueloId`), so there is no second copy of the route on the booking.
 */
@Entity('vuelos_flight_hold_items')
@Unique('UQ_hold_item_orden', ['holdId', 'orden'])
@Unique('UQ_hold_item_itinerary', ['holdId', 'itineraryId'])
@Index('IDX_hold_item_vuelo', ['vueloId'])
export class FlightHoldItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  holdId: string;

  @ManyToOne(() => FlightHold, (hold) => hold.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'holdId' })
  hold?: FlightHold;

  @Column({ type: 'int' })
  orden: number;

  @Column({ type: 'uuid' })
  itineraryId: string;

  @Column({ type: 'uuid' })
  vueloId: string;

  @ManyToOne(() => Vuelo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vueloId' })
  vuelo?: Vuelo;

  @Column({ type: 'int' })
  seats: number;

  @Column({ type: 'varchar', length: 20, default: 'ECONOMY' })
  cabinClass: string;

  @Column({ type: 'varchar', length: 20 })
  fareBrand: string;

  @ManyToOne(() => FareFamily, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fareBrand', referencedColumnName: 'code' })
  family?: FareFamily;
}
