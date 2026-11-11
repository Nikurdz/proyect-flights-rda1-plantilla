import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

// RF-SHP-001: cities/airports with IATA code, name, country and timezone. The *Norm columns
// hold the accent-free, lower-case text that prefix search runs against (RF-SHP-002).
@Entity('ecom_localidades')
export class Localidad {
  @PrimaryColumn({ type: 'char', length: 3 })
  iata: string;

  @Column({ type: 'varchar', length: 100 })
  ciudad: string;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'char', length: 2 })
  pais: string;

  @Column({ type: 'varchar', length: 100 })
  paisNombre: string;

  // IANA timezone; stored so local airport times can be shown without a second catalog.
  @Column({ type: 'varchar', length: 50 })
  zonaHoraria: string;

  @Index('IDX_ecom_localidades_ciudad_norm')
  @Column({ type: 'varchar', length: 100 })
  ciudadNorm: string;

  @Column({ type: 'varchar', length: 150 })
  nombreNorm: string;
}
