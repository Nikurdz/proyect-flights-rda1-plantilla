import { createDecipheriv, createCipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

const FIELDS = ['firstName', 'lastName', 'documentNumber', 'birthDate', 'contactEmail', 'contactPhone'] as const;

/**
 * Same key resolution as vuelos-config.ts, without Nest: an explicit DATA_ENCRYPTION_KEY, or in
 * development the key derived from JWT_SECRET. Only needed when rows already exist.
 */
function resolveKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (raw) {
    const key = Buffer.from(raw, 'base64');
    if (key.length === 32) return key;
    throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes encoded as base64');
  }
  const secret = process.env.JWT_SECRET ?? '';
  if (process.env.NODE_ENV !== 'production' && secret.length >= 32) {
    return Buffer.from(hkdfSync('sha256', secret, '', 'vuelos-data-encryption', 32));
  }
  throw new Error('vuelos_passengers has rows to encrypt: set DATA_ENCRYPTION_KEY (the same value the app will use) and run the migration again');
}

// Same `v1:<iv>:<tag>:<ciphertext>` format as common/cifrado.ts (kept inline: a migration must not change when the app does).
const encrypt = (key: Buffer, value: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
};

const decrypt = (key: Buffer, payload: string): string => {
  const [, iv, tag, data] = payload.split(':');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')) as string;
};

/** C1: passenger identity and contact data of the flight core is stored encrypted, like the e-commerce order snapshot. */
export class EncryptPassengerPii1791254000000 implements MigrationInterface {
  name = 'EncryptPassengerPii1791254000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const rows: Record<string, string>[] = await queryRunner.query(`SELECT "passengerId", ${FIELDS.map((f) => `"${f}"::text AS "${f}"`).join(', ')} FROM "vuelos_passengers"`);
    const key = rows.length > 0 ? resolveKey() : null;

    for (const field of FIELDS) {
      await queryRunner.query(`ALTER TABLE "vuelos_passengers" ALTER COLUMN "${field}" TYPE text USING "${field}"::text`);
    }
    for (const row of rows) {
      const sets = FIELDS.map((f, i) => `"${f}" = $${i + 2}`).join(', ');
      await queryRunner.query(`UPDATE "vuelos_passengers" SET ${sets} WHERE "passengerId" = $1`, [row.passengerId, ...FIELDS.map((f) => encrypt(key!, row[f]))]);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const rows: Record<string, string>[] = await queryRunner.query(`SELECT "passengerId", ${FIELDS.map((f) => `"${f}"`).join(', ')} FROM "vuelos_passengers"`);
    const key = rows.length > 0 ? resolveKey() : null;

    for (const row of rows) {
      const sets = FIELDS.map((f, i) => `"${f}" = $${i + 2}`).join(', ');
      await queryRunner.query(`UPDATE "vuelos_passengers" SET ${sets} WHERE "passengerId" = $1`, [row.passengerId, ...FIELDS.map((f) => decrypt(key!, row[f]))]);
    }
    await queryRunner.query(`ALTER TABLE "vuelos_passengers" ALTER COLUMN "firstName" TYPE character varying(100)`);
    await queryRunner.query(`ALTER TABLE "vuelos_passengers" ALTER COLUMN "lastName" TYPE character varying(100)`);
    await queryRunner.query(`ALTER TABLE "vuelos_passengers" ALTER COLUMN "documentNumber" TYPE character varying(50)`);
    await queryRunner.query(`ALTER TABLE "vuelos_passengers" ALTER COLUMN "birthDate" TYPE date USING "birthDate"::date`);
    await queryRunner.query(`ALTER TABLE "vuelos_passengers" ALTER COLUMN "contactEmail" TYPE character varying(150)`);
    await queryRunner.query(`ALTER TABLE "vuelos_passengers" ALTER COLUMN "contactPhone" TYPE character varying(30)`);
  }
}
