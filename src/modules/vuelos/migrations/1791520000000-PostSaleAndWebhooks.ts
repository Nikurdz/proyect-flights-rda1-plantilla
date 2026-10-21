import { MigrationInterface, QueryRunner } from "typeorm";

export class PostSaleAndWebhooks1791520000000 implements MigrationInterface {
    name = 'PostSaleAndWebhooks1791520000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vuelos_webhook_subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" character varying(100) NOT NULL, "url" character varying(500) NOT NULL, "events" jsonb NOT NULL, "secret" text NOT NULL, "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_73cbf67b88c14731eabcf0a48b8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_vuelos_webhooks_owner" ON "vuelos_webhook_subscriptions" ("ownerId") `);
        await queryRunner.query(`CREATE TABLE "vuelos_webhook_deliveries" ("deliveryId" uuid NOT NULL DEFAULT uuid_generate_v4(), "subscriptionId" uuid NOT NULL, "eventId" uuid NOT NULL, "eventType" character varying(40) NOT NULL, "payload" jsonb NOT NULL, "status" character varying(12) NOT NULL DEFAULT 'PENDING', "attempts" integer NOT NULL DEFAULT '0', "nextAttemptAt" TIMESTAMP WITH TIME ZONE NOT NULL, "lastStatusCode" integer, "lastError" character varying(300), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deliveredAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_vuelos_webhook_delivery_event" UNIQUE ("subscriptionId", "eventId"), CONSTRAINT "PK_0aed36861c1c0f5d8d0d6fd4df0" PRIMARY KEY ("deliveryId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_vuelos_webhook_delivery_due" ON "vuelos_webhook_deliveries" ("status", "nextAttemptAt") `);
        await queryRunner.query(`CREATE TABLE "vuelos_date_change_offers" ("changeOfferId" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingId" uuid NOT NULL, "ownerId" character varying(100) NOT NULL, "itineraryId" uuid NOT NULL, "fromVueloId" uuid NOT NULL, "toVueloId" uuid NOT NULL, "fareDifferenceMinor" integer NOT NULL, "taxDifferenceMinor" integer NOT NULL, "changeFeeMinor" integer NOT NULL, "totalToPayMinor" integer NOT NULL, "currency" character(3) NOT NULL, "status" character varying(10) NOT NULL DEFAULT 'OPEN', "paymentReference" character varying(100), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_fbd33f65613cb1ce25608044a2a" PRIMARY KEY ("changeOfferId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_vuelos_change_offers_booking" ON "vuelos_date_change_offers" ("bookingId") `);
        await queryRunner.query(`CREATE TABLE "vuelos_check_ins" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingId" uuid NOT NULL, "passengerId" uuid NOT NULL, "vueloId" uuid NOT NULL, "seat" character varying(4), "boardingGroup" character(1) NOT NULL, "boardingPosition" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_vuelos_checkin_passenger_flight" UNIQUE ("bookingId", "passengerId", "vueloId"), CONSTRAINT "PK_3746e18aec6aaa832bbc610e09f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_vuelos_checkin_vuelo" ON "vuelos_check_ins" ("vueloId") `);
        await queryRunner.query(`CREATE TABLE "vuelos_cancellation_quotes" ("quoteId" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingId" uuid NOT NULL, "ownerId" character varying(100) NOT NULL, "isRefundable" boolean NOT NULL, "refundMinor" integer NOT NULL, "penaltyMinor" integer NOT NULL, "currency" character(3) NOT NULL, "status" character varying(10) NOT NULL DEFAULT 'OPEN', "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_50705aa513c64db7ad1e6b910c7" PRIMARY KEY ("quoteId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_vuelos_cancel_quotes_booking" ON "vuelos_cancellation_quotes" ("bookingId") `);
        await queryRunner.query(`CREATE TABLE "vuelos_baggage_purchases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingId" uuid NOT NULL, "passengerId" uuid NOT NULL, "itineraryId" uuid NOT NULL, "vueloId" uuid NOT NULL, "quantity" integer NOT NULL, "unitPriceMinor" integer NOT NULL, "totalMinor" integer NOT NULL, "currency" character(3) NOT NULL, "paymentReference" character varying(100) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e3f92f7e07becc22f019625ba5a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_vuelos_baggage_payment" ON "vuelos_baggage_purchases" ("paymentReference") `);
        await queryRunner.query(`CREATE INDEX "IDX_vuelos_baggage_booking" ON "vuelos_baggage_purchases" ("bookingId") `);
        await queryRunner.query(`ALTER TABLE "vuelos" ADD "estado" character varying(12) NOT NULL DEFAULT 'SCHEDULED'`);
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" ADD "changes" jsonb`);
        await queryRunner.query(`ALTER TABLE "ecom_pagos" ADD "reembolsoMinor" bigint`);
        await queryRunner.query(`CREATE INDEX "IDX_ecom_ordenes_booking" ON "ecom_ordenes" ("bookingId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_ecom_ordenes_booking"`);
        await queryRunner.query(`ALTER TABLE "ecom_pagos" DROP COLUMN "reembolsoMinor"`);
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" DROP COLUMN "changes"`);
        await queryRunner.query(`ALTER TABLE "vuelos" DROP COLUMN "estado"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_vuelos_baggage_booking"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_vuelos_baggage_payment"`);
        await queryRunner.query(`DROP TABLE "vuelos_baggage_purchases"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_vuelos_cancel_quotes_booking"`);
        await queryRunner.query(`DROP TABLE "vuelos_cancellation_quotes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_vuelos_checkin_vuelo"`);
        await queryRunner.query(`DROP TABLE "vuelos_check_ins"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_vuelos_change_offers_booking"`);
        await queryRunner.query(`DROP TABLE "vuelos_date_change_offers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_vuelos_webhook_delivery_due"`);
        await queryRunner.query(`DROP TABLE "vuelos_webhook_deliveries"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_vuelos_webhooks_owner"`);
        await queryRunner.query(`DROP TABLE "vuelos_webhook_subscriptions"`);
    }

}
