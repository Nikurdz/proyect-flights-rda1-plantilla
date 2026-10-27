import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * An integrator allowed to call /api/v2/vuelos with an OAuth2 client_credentials token (Booking Prototipo).
 * Only a scrypt hash of the secret is kept. `scopes` is the space-separated OAuth2 scope string the client may request.
 */
@Entity('vuelos_partner_clients')
export class PartnerClient {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  clientId: string;

  @Column({ type: 'varchar', length: 200 })
  secretHash: string;

  @Column({ type: 'varchar', length: 300 })
  scopes: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
