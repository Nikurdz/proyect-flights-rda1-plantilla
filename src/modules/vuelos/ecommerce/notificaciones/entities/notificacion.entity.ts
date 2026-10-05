import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { encryptedJson } from '../../../common/cifrado';

export type TipoNotificacion = 'CONFIRMACION_COMPRA' | 'VERIFICACION_CORREO' | 'CUENTA_BLOQUEADA' | 'EMISION_FALLIDA';
export type EstadoNotificacion = 'ENVIADO' | 'FALLIDO';

/** RF-NTF-008: one row per message with its outcome, attempts and error, so every send is traceable. */
@Entity('ecom_notificaciones')
@Index('IDX_ecom_notificaciones_referencia', ['referencia', 'creadoEn'])
export class Notificacion {
  @PrimaryGeneratedColumn('uuid')
  notificacionId: string;

  // The domain event that caused this message. Unique: a redelivered event sends nothing twice
  // (consumers are idempotent, SRS §10.3).
  @Index('UQ_ecom_notificaciones_evento', { unique: true })
  @Column({ type: 'uuid' })
  eventoId: string;

  @Column({ type: 'varchar', length: 30 })
  tipo: TipoNotificacion;

  @Column({ type: 'varchar', length: 12 })
  canal: string;

  @Column({ type: 'varchar', length: 150 })
  destinatario: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  mercado: string | null;

  @Column({ type: 'varchar', length: 5 })
  idioma: string;

  @Column({ type: 'int' })
  plantillaVersion: number;

  @Column({ type: 'varchar', length: 200 })
  asunto: string;

  // Bodies can carry personal data and one-time links, so they are stored encrypted.
  @Column({ type: 'text', transformer: encryptedJson<string>() })
  cuerpo: string;

  // The aggregate the message is about (an order, a customer).
  @Column({ type: 'varchar', length: 100 })
  referencia: string;

  @Column({ type: 'varchar', length: 10 })
  estado: EstadoNotificacion;

  @Column({ type: 'int', default: 0 })
  intentos: number;

  @Column({ type: 'varchar', length: 300, nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
