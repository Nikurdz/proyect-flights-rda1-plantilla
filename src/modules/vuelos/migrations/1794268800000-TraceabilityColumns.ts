import { MigrationInterface, QueryRunner } from "typeorm";

export class TraceabilityColumns1794268800000 implements MigrationInterface {
    name = 'TraceabilityColumns1794268800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // All nullable: the rows written before this migration simply have no actor or correlation.
        await queryRunner.query(`ALTER TABLE "auditoria_transacciones" ADD "actorId" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "auditoria_transacciones" ADD "actorTipo" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "auditoria_transacciones" ADD "entidad" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "auditoria_transacciones" ADD "numero" character varying(40)`);
        await queryRunner.query(`ALTER TABLE "auditoria_transacciones" ADD "origen" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "auditoria_transacciones" ADD "destino" character varying(20)`);
        await queryRunner.query(`CREATE INDEX "IDX_auditoria_transacciones_numero" ON "auditoria_transacciones" ("numero") `);
        await queryRunner.query(`ALTER TABLE "auditoria_administrativa" ADD "correlationId" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "auditoria_administrativa" ADD "ip" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "auditoria_administrativa" ADD "userAgent" character varying(200)`);
        await queryRunner.query(`CREATE INDEX "IDX_auditoria_administrativa_correlacion" ON "auditoria_administrativa" ("correlationId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_auditoria_administrativa_correlacion"`);
        await queryRunner.query(`ALTER TABLE "auditoria_administrativa" DROP COLUMN "userAgent"`);
        await queryRunner.query(`ALTER TABLE "auditoria_administrativa" DROP COLUMN "ip"`);
        await queryRunner.query(`ALTER TABLE "auditoria_administrativa" DROP COLUMN "correlationId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_auditoria_transacciones_numero"`);
        await queryRunner.query(`ALTER TABLE "auditoria_transacciones" DROP COLUMN "destino"`);
        await queryRunner.query(`ALTER TABLE "auditoria_transacciones" DROP COLUMN "origen"`);
        await queryRunner.query(`ALTER TABLE "auditoria_transacciones" DROP COLUMN "numero"`);
        await queryRunner.query(`ALTER TABLE "auditoria_transacciones" DROP COLUMN "entidad"`);
        await queryRunner.query(`ALTER TABLE "auditoria_transacciones" DROP COLUMN "actorTipo"`);
        await queryRunner.query(`ALTER TABLE "auditoria_transacciones" DROP COLUMN "actorId"`);
    }

}
