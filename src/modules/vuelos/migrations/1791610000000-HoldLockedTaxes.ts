import { MigrationInterface, QueryRunner } from "typeorm";

export class HoldLockedTaxes1791610000000 implements MigrationInterface {
    name = 'HoldLockedTaxes1791610000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Nullable on purpose: holds created before this column keep pricing the refund from the live fare.
        await queryRunner.query(`ALTER TABLE "vuelos_flight_holds" ADD "lockedTaxesMinor" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vuelos_flight_holds" DROP COLUMN "lockedTaxesMinor"`);
    }

}
