import { Column, Entity, PrimaryColumn } from 'typeorm';

/** An airline that operates flights: its IATA code and name, stored once (a flight points at it by code). */
@Entity('vuelos_aerolineas')
export class Aerolinea {
  @PrimaryColumn({ type: 'varchar', length: 2 })
  codigo: string;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;
}
