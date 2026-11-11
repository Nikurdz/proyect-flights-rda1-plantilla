import { MigrationInterface, QueryRunner } from 'typeorm';

/** Admin observability: the summary counts payments, offers and notifications over a time window. */
export class ObservabilityIndexes1791430000000 implements MigrationInterface {
  name = 'ObservabilityIndexes1791430000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_ecom_pagos_creado" ON "ecom_pagos" ("creadoEn")`);
    await queryRunner.query(`CREATE INDEX "IDX_ecom_ofertas_creada" ON "ecom_ofertas" ("creadaEn")`);
    await queryRunner.query(`CREATE INDEX "IDX_ecom_notificaciones_creado" ON "ecom_notificaciones" ("creadoEn")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_ecom_notificaciones_creado"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ecom_ofertas_creada"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ecom_pagos_creado"`);
  }
}
