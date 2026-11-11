import { MigrationInterface, QueryRunner } from "typeorm";

export class ContractV21793059559095 implements MigrationInterface {
    name = 'ContractV21793059559095'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vuelos_promocion_contrato" ("id" character varying(40) NOT NULL, "permitePromociones" boolean NOT NULL, "porcentajeDescuentoMaximo" numeric(5,2) NOT NULL, "vigenciaHasta" date, "condicionesCombo" character varying(500), "actualizadoEn" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8d4d4b57ef5dd610e824e49f211" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "vuelos_promocion_alcance" ("contratoId" character varying(40) NOT NULL, "tipo" character varying(10) NOT NULL, "valor" character varying(20) NOT NULL, CONSTRAINT "PK_0fddad7cffcaa5e9ab6664c2ebe" PRIMARY KEY ("contratoId", "tipo", "valor"))`);
        await queryRunner.query(`CREATE INDEX "IDX_vuelos_promocion_alcance_contrato" ON "vuelos_promocion_alcance" ("contratoId") `);
        await queryRunner.query(`CREATE TABLE "vuelos_partner_clients" ("clientId" character varying(80) NOT NULL, "secretHash" character varying(200) NOT NULL, "scopes" character varying(300) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_107dc683db3702c867bd87f721a" PRIMARY KEY ("clientId"))`);
        await queryRunner.query(`CREATE TABLE "vuelos_outbox" ("seq" BIGSERIAL NOT NULL, "eventoId" uuid NOT NULL, "type" character varying(40) NOT NULL, "subject" character varying(100) NOT NULL, "correlationId" character varying(100) NOT NULL, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "cloudEvent" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_198e68f4570c7119bdebb26c555" PRIMARY KEY ("seq"))`);
        await queryRunner.query(`CREATE INDEX "IDX_vuelos_outbox_tipo" ON "vuelos_outbox" ("type", "seq") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_vuelos_outbox_evento" ON "vuelos_outbox" ("eventoId") `);
        await queryRunner.query(`ALTER TABLE "vuelos_webhook_subscriptions" ADD "apiVersion" smallint NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "vuelos" ADD "retrasoMinutos" integer`);
        await queryRunner.query(`ALTER TABLE "vuelos" ADD "salidaEstimada" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "vuelos" ADD "llegadaEstimada" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "vuelos" ADD "puertaSalida" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "vuelos" ADD "estadoActualizadoEn" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" ADD "channelPartnerId" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" ADD "channelPartnerOrderId" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" ADD "channelPackageId" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" ADD "channelPromotionApplied" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" ADD "channelDiscountPercentage" numeric(5,2)`);
        await queryRunner.query(`ALTER TABLE "vuelos_promocion_alcance" ADD CONSTRAINT "FK_efd24ea245328babf917c5955b0" FOREIGN KEY ("contratoId") REFERENCES "vuelos_promocion_contrato"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vuelos_promocion_alcance" DROP CONSTRAINT "FK_efd24ea245328babf917c5955b0"`);
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" DROP COLUMN "channelDiscountPercentage"`);
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" DROP COLUMN "channelPromotionApplied"`);
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" DROP COLUMN "channelPackageId"`);
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" DROP COLUMN "channelPartnerOrderId"`);
        await queryRunner.query(`ALTER TABLE "vuelos_bookings" DROP COLUMN "channelPartnerId"`);
        await queryRunner.query(`ALTER TABLE "vuelos" DROP COLUMN "estadoActualizadoEn"`);
        await queryRunner.query(`ALTER TABLE "vuelos" DROP COLUMN "puertaSalida"`);
        await queryRunner.query(`ALTER TABLE "vuelos" DROP COLUMN "llegadaEstimada"`);
        await queryRunner.query(`ALTER TABLE "vuelos" DROP COLUMN "salidaEstimada"`);
        await queryRunner.query(`ALTER TABLE "vuelos" DROP COLUMN "retrasoMinutos"`);
        await queryRunner.query(`ALTER TABLE "vuelos_webhook_subscriptions" DROP COLUMN "apiVersion"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_vuelos_outbox_evento"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_vuelos_outbox_tipo"`);
        await queryRunner.query(`DROP TABLE "vuelos_outbox"`);
        await queryRunner.query(`DROP TABLE "vuelos_partner_clients"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_vuelos_promocion_alcance_contrato"`);
        await queryRunner.query(`DROP TABLE "vuelos_promocion_alcance"`);
        await queryRunner.query(`DROP TABLE "vuelos_promocion_contrato"`);
    }

}
