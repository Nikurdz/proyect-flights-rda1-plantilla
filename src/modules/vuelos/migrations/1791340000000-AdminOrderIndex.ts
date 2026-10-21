import { MigrationInterface, QueryRunner } from 'typeorm';

/** Back-office order list: newest first across all customers, keyset-paginated on (creadaEn, ordenId). */
export class AdminOrderIndex1791340000000 implements MigrationInterface {
  name = 'AdminOrderIndex1791340000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_ecom_ordenes_creada" ON "ecom_ordenes" ("creadaEn", "ordenId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_ecom_ordenes_creada"`);
  }
}
