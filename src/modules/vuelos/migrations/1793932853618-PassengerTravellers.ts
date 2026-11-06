import { createDecipheriv, createHmac, hkdfSync } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Same key resolution as vuelos-config.ts, without Nest: an explicit DATA_ENCRYPTION_KEY, or in development the key derived
 * from JWT_SECRET. Only needed when passengers already exist (to read their documents and index them).
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
  throw new Error('vuelos_passengers has rows to index: set DATA_ENCRYPTION_KEY (the same value the app uses) and run the migration again');
}

// Same `v1:<iv>:<tag>:<ciphertext>` format as common/cifrado.ts (kept inline: a migration must not change when the app does).
const decrypt = (key: Buffer, payload: string): string => {
  const [, iv, tag, data] = payload.split(':');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')) as string;
};

// Same derivation and normalisation as FieldCipher.blindIndex / common/travellers.ts documentHashOf.
const documentHash = (key: Buffer, type: string, nationality: string, number: string): string => {
  const blindKey = Buffer.from(hkdfSync('sha256', key, '', 'vuelos-document-index', 32));
  const normalised = number.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();
  return createHmac('sha256', blindKey).update(`${type.toUpperCase()}|${nationality.toUpperCase()}|${normalised}`).digest('hex');
};

/**
 * One traveller per travel document (blind index) so the same person is found, and counted once, across bookings;
 * the payment provider of the sale; and an index to look a booking up by the partner's order id. Existing passengers are
 * linked to their traveller here (their documents are decrypted with the app key to build the index).
 */
export class PassengerTravellers1793932853618 implements MigrationInterface {
  name = 'PassengerTravellers1793932853618';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "vuelos_travellers" ("travellerId" uuid NOT NULL DEFAULT uuid_generate_v4(), "documentType" character varying(20) NOT NULL, "nationality" character varying(2) NOT NULL, "documentHash" character(64) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_948161dec7a5d914b74424dcca6" PRIMARY KEY ("travellerId"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_vuelos_travellers_document" ON "vuelos_travellers" ("documentHash") `);
    await queryRunner.query(`ALTER TABLE "vuelos_bookings" ADD "paymentProvider" character varying(30)`);
    await queryRunner.query(`CREATE INDEX "IDX_vuelos_bookings_partner_order" ON "vuelos_bookings" ("channelPartnerOrderId") `);
    await queryRunner.query(`ALTER TABLE "vuelos_passengers" ADD "travellerId" uuid`);

    // Backfill: a traveller per distinct document, then every passenger row points to its traveller.
    const rows: { passengerId: string; documentType: string; nationality: string; documentNumber: string }[] = await queryRunner.query(
      `SELECT "passengerId", "documentType", "nationality", "documentNumber" FROM "vuelos_passengers"`,
    );
    if (rows.length > 0) {
      const key = resolveKey();
      const travellers = new Map<string, { documentType: string; nationality: string }>();
      const hashOf = new Map<string, string>();
      for (const row of rows) {
        const hash = documentHash(key, row.documentType, row.nationality, decrypt(key, row.documentNumber));
        hashOf.set(row.passengerId, hash);
        travellers.set(hash, { documentType: row.documentType.toUpperCase(), nationality: row.nationality.toUpperCase() });
      }
      for (const [hash, t] of travellers) {
        await queryRunner.query(`INSERT INTO "vuelos_travellers" ("documentType", "nationality", "documentHash") VALUES ($1, $2, $3) ON CONFLICT ("documentHash") DO NOTHING`, [t.documentType, t.nationality, hash]);
      }
      for (const row of rows) {
        await queryRunner.query(`UPDATE "vuelos_passengers" SET "travellerId" = (SELECT "travellerId" FROM "vuelos_travellers" WHERE "documentHash" = $2) WHERE "passengerId" = $1`, [row.passengerId, hashOf.get(row.passengerId)]);
      }
    }

    await queryRunner.query(`ALTER TABLE "vuelos_passengers" ALTER COLUMN "travellerId" SET NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_vuelos_passengers_traveller" ON "vuelos_passengers" ("travellerId") `);
    await queryRunner.query(`ALTER TABLE "vuelos_passengers" ADD CONSTRAINT "FK_b983b0f44b63ef12177c5a44fb5" FOREIGN KEY ("travellerId") REFERENCES "vuelos_travellers"("travellerId") ON DELETE RESTRICT ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "vuelos_passengers" DROP CONSTRAINT "FK_b983b0f44b63ef12177c5a44fb5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_vuelos_passengers_traveller"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_vuelos_bookings_partner_order"`);
    await queryRunner.query(`ALTER TABLE "vuelos_passengers" DROP COLUMN "travellerId"`);
    await queryRunner.query(`ALTER TABLE "vuelos_bookings" DROP COLUMN "paymentProvider"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_vuelos_travellers_document"`);
    await queryRunner.query(`DROP TABLE "vuelos_travellers"`);
  }
}
