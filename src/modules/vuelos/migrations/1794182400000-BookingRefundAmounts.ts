import { MigrationInterface, QueryRunner } from "typeorm";

export class BookingRefundAmounts1794182400000 implements MigrationInterface {
    name = 'BookingRefundAmounts1794182400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Nullable on purpose: bookings cancelled before these columns keep their amounts only in the change history.
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" ADD "refundMinor" bigint`);
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" ADD "penaltyMinor" bigint`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" DROP COLUMN "penaltyMinor"`);
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" DROP COLUMN "refundMinor"`);
    }

}
