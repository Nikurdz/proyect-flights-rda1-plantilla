import { MigrationInterface, QueryRunner } from "typeorm";

export class FlightHoldSeats1794355200000 implements MigrationInterface {
    name = 'FlightHoldSeats1794355200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Seats set aside by an active hold. A new, empty table: holds created before it simply hold no seat.
        await queryRunner.query(`CREATE TABLE "vuelos_flight_hold_seats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "holdId" uuid NOT NULL, "vueloId" uuid NOT NULL, "seatNumber" character varying(4) NOT NULL, CONSTRAINT "UQ_hold_seat_vuelo_numero" UNIQUE ("vueloId", "seatNumber"), CONSTRAINT "PK_vuelos_flight_hold_seats" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_hold_seat_hold" ON "vuelos_flight_hold_seats" ("holdId") `);
        await queryRunner.query(`ALTER TABLE "vuelos_flight_hold_seats" ADD CONSTRAINT "FK_hold_seat_hold" FOREIGN KEY ("holdId") REFERENCES "vuelos_flight_holds"("holdId") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vuelos_flight_hold_seats" ADD CONSTRAINT "FK_hold_seat_vuelo" FOREIGN KEY ("vueloId") REFERENCES "vuelos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vuelos_flight_hold_seats" DROP CONSTRAINT "FK_hold_seat_vuelo"`);
        await queryRunner.query(`ALTER TABLE "vuelos_flight_hold_seats" DROP CONSTRAINT "FK_hold_seat_hold"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_hold_seat_hold"`);
        await queryRunner.query(`DROP TABLE "vuelos_flight_hold_seats"`);
    }

}
