import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { encryptedJson } from '../../../common/cifrado';

/**
 * The billing identity of a buyer (RF-CHK-011), stored once. The offer points at it while it is edited and the order
 * and its invoice keep pointing at the same row, so the data is never copied from one table to the next.
 * The tax id, the name and the address are personal data: encrypted at rest (RNF-18).
 */
@Entity('ecom_datos_facturacion')
export class DatosFacturacion {
  @PrimaryGeneratedColumn('uuid')
  datosFacturacionId: string;

  // CEDULA, RUC, PASAPORTE… the types come from the market configuration.
  @Column({ type: 'varchar', length: 30 })
  tipoIdentificacion: string;

  @Column({ type: 'text', transformer: encryptedJson<string>() })
  numeroIdentificacion: string;

  @Column({ type: 'text', transformer: encryptedJson<string>() })
  razonSocial: string;

  @Column({ type: 'text', transformer: encryptedJson<string>() })
  direccion: string;

  @Column({ type: 'char', length: 2 })
  pais: string;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
