import { MigrationInterface, QueryRunner } from "typeorm";

export class PerformanceIndexes1794441600000 implements MigrationInterface {
    name = 'PerformanceIndexes1794441600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Additive: the seat status lookup reads tickets by passenger, and the event feed filters by creation time.
        await queryRunner.query(`CREATE INDEX "IDX_vuelos_tickets_passenger" ON "vuelos_tickets" ("passengerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_vuelos_outbox_created" ON "vuelos_outbox" ("createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_vuelos_outbox_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_vuelos_tickets_passenger"`);
    }

}
