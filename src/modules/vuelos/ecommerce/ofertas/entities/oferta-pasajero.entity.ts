import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation, Unique } from 'typeorm';
import { encryptedJson } from '../../../common/cifrado';
import type { PassengerType } from '../../../common/pricing.util';
import { Vuelo } from '../../../entities/vuelo.entity';
import { Oferta } from './oferta.entity';

/** A seat the passenger picked on one leg (a flight); `trayectoId` is the Vuelo id. */
@Entity('ecom_oferta_pasajero_asientos')
@Unique('UQ_oferta_pasajero_asiento', ['pasajeroId', 'vueloId'])
export class OfertaPasajeroAsiento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pasajeroId: string;

  @ManyToOne(() => OfertaPasajero, (pasajero) => pasajero.asientos, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'pasajeroId' })
  pasajero?: Relation<OfertaPasajero>;

  @Column({ type: 'uuid' })
  vueloId: string;

  @ManyToOne(() => Vuelo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vueloId' })
  vuelo?: Vuelo;

  @Column({ type: 'varchar', length: 4 })
  asiento: string;
}

/** A special need of a passenger (wheelchair, meal…), one row each. */
@Entity('ecom_oferta_pasajero_necesidades')
@Unique('UQ_oferta_pasajero_necesidad', ['pasajeroId', 'necesidad'])
export class OfertaPasajeroNecesidad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pasajeroId: string;

  @ManyToOne(() => OfertaPasajero, (pasajero) => pasajero.necesidades, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'pasajeroId' })
  pasajero?: Relation<OfertaPasajero>;

  @Column({ type: 'varchar', length: 40 })
  necesidad: string;
}

/**
 * A traveller as the buyer typed them in at checkout. After the sale this is also what the order shows (the order has
 * no copy of its own). Identity data is personal data: encrypted at rest (RNF-18).
 */
@Entity('ecom_oferta_pasajeros')
@Unique('UQ_oferta_pasajero_cliente', ['ofertaId', 'idCliente'])
@Index('IDX_oferta_pasajero_oferta', ['ofertaId', 'orden'])
export class OfertaPasajero {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ofertaId: string;

  @ManyToOne(() => Oferta, (oferta) => oferta.pasajeros, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'ofertaId' })
  oferta?: Oferta;

  @Column({ type: 'int' })
  orden: number;

  // The id the buyer chose for the passenger ("a1"); the flight core keeps it as `clientPassengerId`.
  @Column({ type: 'varchar', length: 100 })
  idCliente: string;

  @Column({ type: 'varchar', length: 10 })
  tipo: PassengerType;

  // idCliente of the adult a lap infant travels with.
  @Column({ type: 'varchar', length: 100, nullable: true })
  asociadoA: string | null;

  @Column({ type: 'text', transformer: encryptedJson<string>() })
  nombres: string;

  @Column({ type: 'text', transformer: encryptedJson<string>() })
  apellidos: string;

  @Column({ type: 'text', transformer: encryptedJson<string>() })
  fechaNacimiento: string;

  @Column({ type: 'char', length: 1 })
  genero: 'M' | 'F' | 'X';

  @Column({ type: 'char', length: 2 })
  nacionalidad: string;

  @Column({ type: 'varchar', length: 20 })
  documentoTipo: 'PASSPORT' | 'NATIONAL_ID';

  @Column({ type: 'text', transformer: encryptedJson<string>() })
  documentoNumero: string;

  @Column({ type: 'date', nullable: true })
  documentoVencimiento: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  numeroSocio: string | null;

  @OneToMany(() => OfertaPasajeroNecesidad, (n) => n.pasajero, { cascade: true })
  necesidades?: OfertaPasajeroNecesidad[];

  @OneToMany(() => OfertaPasajeroAsiento, (a) => a.pasajero, { cascade: true })
  asientos?: OfertaPasajeroAsiento[];
}
