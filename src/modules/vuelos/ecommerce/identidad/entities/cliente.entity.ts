import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type CanalNotificacion = 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';

@Entity('ecom_clientes')
export class Cliente {
  @PrimaryGeneratedColumn('uuid')
  clienteId: string;

  // Always stored lower-cased and trimmed; the unique index makes registration race-proof.
  @Index('UQ_ecom_clientes_correo', { unique: true })
  @Column({ type: 'varchar', length: 150 })
  correo: string;

  @Column({ type: 'boolean', default: false })
  correoVerificado: boolean;

  // scrypt string (see password.util.ts); the password itself is never stored or logged.
  @Column({ type: 'varchar', length: 300 })
  hashContrasena: string;

  @Column({ type: 'varchar', length: 100 })
  nombres: string;

  @Column({ type: 'varchar', length: 100 })
  apellidos: string;

  @Column({ type: 'date' })
  fechaNacimiento: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  // RF-IAM-002: the site account and the LATAM Pass account are the same; the number is
  // issued at registration (there is no external loyalty system to link to in this phase).
  @Index('UQ_ecom_clientes_socio', { unique: true })
  @Column({ type: 'varchar', length: 20 })
  numeroSocio: string;

  @Column({ type: 'varchar', length: 5 })
  mercadoPreferido: string;

  @Column({ type: 'varchar', length: 5 })
  idiomaPreferido: string;

  @Column({ type: 'varchar', length: 12, default: 'EMAIL' })
  canalNotificacion: CanalNotificacion;

  // RF-IAM-001 / RN-35: marketing consent is separate, optional and revocable.
  @Column({ type: 'boolean', default: false })
  consentimientoMarketing: boolean;

  @Column({ type: 'varchar', length: 20 })
  terminosVersionAceptada: string;

  @Column({ type: 'timestamptz' })
  terminosAceptadosEn: Date;

  // Set by the service on registration. No column default: TypeORM reports any array default as
  // schema drift on every run, which would make `migration:generate --check` unusable.
  @Column({ type: 'text', array: true })
  roles: string[];

  @Column({ type: 'int', default: 0 })
  intentosFallidos: number;

  @Column({ type: 'timestamptz', nullable: true })
  bloqueadoHasta: Date | null;

  // Only the SHA-256 of the one-time verification token is stored.
  @Column({ type: 'char', length: 64, nullable: true })
  tokenVerificacionHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  tokenVerificacionVenceEn: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
