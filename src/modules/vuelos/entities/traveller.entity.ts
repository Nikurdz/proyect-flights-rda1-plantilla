import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A person, once: every passenger row (one per booking) of the same travel document points here. The document itself
 * is encrypted on the passenger rows and cannot be searched, so the person is identified by a blind index: an HMAC of
 * `type|nationality|normalised number` under a key derived from the encryption key (`FieldCipher.blindIndex`).
 * Equal documents give equal hashes, so "find the passenger by cédula" and "the same passenger in two bookings" are
 * plain indexed lookups, and the table holds no readable personal data.
 */
@Entity('vuelos_travellers')
@Index('UQ_vuelos_travellers_document', ['documentHash'], { unique: true })
export class Traveller {
  @PrimaryGeneratedColumn('uuid')
  travellerId: string;

  @Column({ type: 'varchar', length: 20 })
  documentType: string;

  @Column({ type: 'varchar', length: 2 })
  nationality: string;

  @Column({ type: 'char', length: 64 })
  documentHash: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
