import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * One passenger checked in on one flight. A lap infant has a row with no seat. The boarding position is the
 * order of arrival on that flight; the group comes from the fare family. Boarding passes are derived from
 * these rows, so there is nothing to keep in sync.
 */
@Entity('vuelos_check_ins')
@Unique('UQ_vuelos_checkin_passenger_flight', ['bookingId', 'passengerId', 'vueloId'])
@Index('IDX_vuelos_checkin_vuelo', ['vueloId'])
export class CheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'uuid' })
  passengerId: string;

  @Column({ type: 'uuid' })
  vueloId: string;

  @Column({ type: 'varchar', length: 4, nullable: true })
  seat: string | null;

  @Column({ type: 'char', length: 1 })
  boardingGroup: string;

  @Column({ type: 'int' })
  boardingPosition: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
