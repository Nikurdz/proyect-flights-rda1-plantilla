import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation, Unique } from 'typeorm';
import { Mercado } from '../../mercados/entities/mercado.entity';

/**
 * One row per domain event that went through the bus: the durable trail of what the system did and in what order.
 * Only the facts that identify the event are kept (never the payload, which carries personal data); the event id is
 * unique, so an event delivered twice is written once.
 */
@Entity('auditoria_transacciones')
@Index('UQ_auditoria_transacciones_evento', ['eventoId'], { unique: true })
@Index('IDX_auditoria_transacciones_correlacion', ['correlationId'])
@Index('IDX_auditoria_transacciones_tipo', ['tipo', 'ocurridoEn'])
@Index('IDX_auditoria_transacciones_agregado', ['agregadoId'])
export class AuditoriaTransaccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  eventoId: string;

  @Column({ type: 'varchar', length: 60 })
  tipo: string;

  @Column({ type: 'varchar', length: 100 })
  agregadoId: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  mercado: string | null;

  @ManyToOne(() => Mercado, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'mercado' })
  mercadoRef?: Relation<Mercado> | null;

  // Verified `sub` of the account the event is about (customer or guest), when the event names one.
  @Column({ type: 'varchar', length: 100, nullable: true })
  propietarioId: string | null;

  @Column({ type: 'varchar', length: 100 })
  correlationId: string;

  // The identifiers of the event (order number, locator, state…), without personal data.
  @Column({ type: 'varchar', length: 300 })
  resumen: string;

  @Column({ type: 'timestamptz', precision: 3 })
  ocurridoEn: Date;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  registradoEn: Date;
}

export type EstadoSaga = 'EN_CURSO' | 'COMPLETADA' | 'COMPENSADA' | 'FALLIDA';
export type EstadoPasoSaga = 'OK' | 'ERROR' | 'COMPENSADO' | 'OMITIDO';

/** One run of a multi-step business process (the purchase saga, the external reservation…) with its outcome. */
@Entity('auditoria_sagas')
@Index('IDX_auditoria_sagas_correlacion', ['correlationId'])
@Index('IDX_auditoria_sagas_estado', ['tipo', 'estado', 'iniciadaEn'])
@Index('IDX_auditoria_sagas_referencia', ['referencia'])
export class AuditoriaSaga {
  @PrimaryGeneratedColumn('uuid')
  sagaId: string;

  @Column({ type: 'varchar', length: 40 })
  tipo: string;

  // What the saga acts on (the offer id for a purchase).
  @Column({ type: 'varchar', length: 100 })
  referencia: string;

  @Column({ type: 'varchar', length: 100 })
  propietarioId: string;

  @Column({ type: 'varchar', length: 100 })
  correlationId: string;

  @Column({ type: 'varchar', length: 12, default: 'EN_CURSO' })
  estado: EstadoSaga;

  @Column({ type: 'varchar', length: 300, nullable: true })
  error: string | null;

  @Column({ type: 'timestamptz', precision: 3 })
  iniciadaEn: Date;

  @Column({ type: 'timestamptz', precision: 3, nullable: true })
  finalizadaEn: Date | null;

  @OneToMany(() => AuditoriaSagaPaso, (paso) => paso.saga)
  pasos?: AuditoriaSagaPaso[];
}

/** One step of a saga, in order: what ran, how it ended and how long it took. */
@Entity('auditoria_saga_pasos')
@Unique('UQ_auditoria_saga_paso', ['sagaId', 'secuencia'])
export class AuditoriaSagaPaso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  sagaId: string;

  @ManyToOne(() => AuditoriaSaga, (saga) => saga.pasos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sagaId' })
  saga?: Relation<AuditoriaSaga>;

  @Column({ type: 'int' })
  secuencia: number;

  @Column({ type: 'varchar', length: 40 })
  nombre: string;

  @Column({ type: 'varchar', length: 12 })
  estado: EstadoPasoSaga;

  @Column({ type: 'varchar', length: 300, nullable: true })
  detalle: string | null;

  @Column({ type: 'int' })
  duracionMs: number;

  @Column({ type: 'timestamptz', precision: 3 })
  en: Date;
}

/**
 * A sample of the HTTP traffic: method, route pattern (never the raw path), status and duration, tied to the
 * correlation id. Bounded on purpose: written in batches and purged after HTTP_LOG_RETENTION_DAYS.
 */
@Entity('peticiones_http')
@Index('IDX_peticiones_http_creada', ['creadaEn'])
@Index('IDX_peticiones_http_correlacion', ['correlationId'])
export class PeticionHttp {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 10 })
  metodo: string;

  @Column({ type: 'varchar', length: 200 })
  ruta: string;

  @Column({ type: 'int' })
  estado: number;

  @Column({ type: 'int' })
  duracionMs: number;

  @Column({ type: 'varchar', length: 100 })
  correlationId: string;

  @Column({ type: 'timestamptz', precision: 3 })
  creadaEn: Date;
}
