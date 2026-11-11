import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { bigintNumber } from '../../../common/bigint.transformer';
import { toIso } from '../../../common/date.util';
import type { PassengerType } from '../../../common/pricing.util';
import { FareFamily } from '../../../entities/fare-family.entity';
import { Vuelo } from '../../../entities/vuelo.entity';
import { Oferta } from './oferta.entity';
import { OfertaTrayectoPrecio } from './oferta-trayecto-precio.entity';

/**
 * One quoted leg of an offer: which flight, which fare family and what it cost for the party. The flight's own data
 * (number, route, times) is NOT copied here: it is read from `vuelo`, so a rescheduled flight shows its new times.
 * Load `vuelo` and `precios` with `cargarOferta` (oferta-loader.ts); the getters below read them.
 */
@Entity('ecom_oferta_trayectos')
@Unique('UQ_oferta_trayecto_orden', ['ofertaId', 'orden'])
@Index('IDX_oferta_trayecto_vuelo', ['vueloId'])
export class OfertaTrayecto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ofertaId: string;

  @ManyToOne(() => Oferta, (oferta) => oferta.trayectos, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'ofertaId' })
  oferta?: Oferta;

  // Position of the leg (0 = outbound).
  @Column({ type: 'int' })
  orden: number;

  @Column({ type: 'uuid' })
  vueloId: string;

  @ManyToOne(() => Vuelo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vueloId' })
  vuelo?: Vuelo;

  // The itineraryId the flight core issued for the same flight inside its own offer/hold.
  @Column({ type: 'uuid' })
  gdsItinerarioId: string;

  @Column({ type: 'varchar', length: 20 })
  familia: string;

  @ManyToOne(() => FareFamily, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'familia', referencedColumnName: 'code' })
  familiaTarifaria?: FareFamily;

  // The whole party on this leg: the sum of unit prices x quantities.
  @Column({ type: 'bigint', transformer: bigintNumber })
  totalMinor: number;

  @OneToMany(() => OfertaTrayectoPrecio, (precio) => precio.trayecto, { cascade: true })
  precios?: OfertaTrayectoPrecio[];

  // ---- read model (needs `vuelo` / `precios` loaded) ----

  /** Vuelo.id: the stable itinerary id the portal selected. */
  get itinerarioId(): string {
    return this.vueloId;
  }
  private get v(): Vuelo {
    if (!this.vuelo) throw new Error(`Leg ${this.id}: flight not loaded (use cargarOferta)`);
    return this.vuelo;
  }
  get numeroVuelo(): string {
    return this.v.codigoVuelo;
  }
  get operadorCodigo(): string {
    return this.v.codigoAerolinea;
  }
  get operadorNombre(): string {
    return this.v.aerolinea;
  }
  get origen(): string {
    return this.v.origenIATA;
  }
  get destino(): string {
    return this.v.destinoIATA;
  }
  get salida(): string {
    return toIso(this.v.fechaSalida);
  }
  get llegada(): string {
    return toIso(this.v.fechaLlegada);
  }
  get duracionMinutos(): number {
    return this.v.durationMinutes;
  }
  get unitarios(): Partial<Record<PassengerType, { baseMinor: number; tasasMinor: number; totalMinor: number }>> {
    const result: Partial<Record<PassengerType, { baseMinor: number; tasasMinor: number; totalMinor: number }>> = {};
    for (const p of this.precios ?? []) result[p.tipoPasajero] = { baseMinor: p.baseMinor, tasasMinor: p.tasasMinor, totalMinor: p.baseMinor + p.tasasMinor };
    return result;
  }
}
