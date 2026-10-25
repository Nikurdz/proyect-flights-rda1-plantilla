import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProveedores1792972360174 implements MigrationInterface {
    name = 'AddProveedores1792972360174'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "proveedores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(100) NOT NULL, "equipo" character varying(100) NOT NULL, "baseUrl" character varying(300) NOT NULL, "tipoServicio" character varying(20) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "creadoEn" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizadoEn" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1dcf121f19f362fb1b4c0a493a9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_proveedores_nombre" ON "proveedores" ("nombre") `);
        await queryRunner.query(`CREATE TABLE "catalogo_externo_categorias" ("catalogoId" uuid NOT NULL, "categoria" character varying(60) NOT NULL, CONSTRAINT "PK_3471b5cfb9781393ac707565168" PRIMARY KEY ("catalogoId", "categoria"))`);
        await queryRunner.query(`CREATE TABLE "catalogo_externo" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "proveedorId" uuid NOT NULL, "externalId" character varying(100) NOT NULL, "tipo" character varying(30) NOT NULL, "nombre" character varying(200) NOT NULL, "descripcion" text NOT NULL, "duracion" character varying(60), "precioMinor" bigint NOT NULL, "moneda" character(3) NOT NULL, "imagenUrl" character varying(500), "cancelacionGratis" boolean NOT NULL DEFAULT false, "activo" boolean NOT NULL DEFAULT true, "sincronizadoEn" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_catalogo_externo_proveedor_id" UNIQUE ("proveedorId", "externalId"), CONSTRAINT "PK_0e91ad1aabd0de68b0e97b16af7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_catalogo_externo_tipo" ON "catalogo_externo" ("tipo", "activo") `);
        await queryRunner.query(`CREATE TABLE "reservas_externas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" character varying(100) NOT NULL, "clienteId" uuid, "proveedorId" uuid NOT NULL, "catalogoId" uuid NOT NULL, "externalReservationId" uuid, "estado" character varying(20) NOT NULL DEFAULT 'PENDIENTE', "fecha" date NOT NULL, "hora" character varying(10), "cantidad" integer NOT NULL, "nombreCliente" text NOT NULL, "correoCliente" text NOT NULL, "totalMinor" bigint NOT NULL, "moneda" character(3) NOT NULL, "datosFacturacionId" uuid NOT NULL, "motivo" character varying(300), "creadaEn" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizadaEn" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a085570bcf485a4cb2aaeee0f3c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_reservas_externas_proveedor" ON "reservas_externas" ("proveedorId", "estado") `);
        await queryRunner.query(`CREATE INDEX "IDX_reservas_externas_owner" ON "reservas_externas" ("ownerId", "creadaEn") `);
        await queryRunner.query(`CREATE TABLE "proveedor_salud" ("id" BIGSERIAL NOT NULL, "proveedorId" uuid NOT NULL, "estado" character varying(10) NOT NULL, "latenciaMs" integer, "detalle" character varying(200), "comprobadoEn" TIMESTAMP(3) WITH TIME ZONE NOT NULL, CONSTRAINT "PK_248f7f58105f0a27d3ccc733e23" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_proveedor_salud_proveedor" ON "proveedor_salud" ("proveedorId", "comprobadoEn") `);
        await queryRunner.query(`ALTER TABLE "ecom_pagos" ADD "reservaExternaId" uuid`);
        await queryRunner.query(`ALTER TABLE "ecom_facturas" ADD "reservaExternaId" uuid`);
        await queryRunner.query(`ALTER TABLE "ecom_facturas" ADD CONSTRAINT "UQ_1c8b1048bb913701bf1cd0279a8" UNIQUE ("reservaExternaId")`);
        await queryRunner.query(`ALTER TABLE "ecom_pagos" DROP CONSTRAINT "FK_3f6dcf9a549b843247a553f6de9"`);
        await queryRunner.query(`DROP INDEX "IDX_ecom_pagos_oferta"`);
        await queryRunner.query(`ALTER TABLE "ecom_pagos" ALTER COLUMN "ofertaId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ecom_facturas" DROP CONSTRAINT "FK_55123faa63aed0ae13ef2aac1b9"`);
        await queryRunner.query(`ALTER TABLE "ecom_facturas" ALTER COLUMN "ordenId" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_ecom_pagos_oferta" ON "ecom_pagos" ("ofertaId", "creadoEn") `);
        await queryRunner.query(`ALTER TABLE "ecom_pagos" ADD CONSTRAINT "CHK_ecom_pagos_origen" CHECK (("ofertaId" IS NOT NULL) <> ("reservaExternaId" IS NOT NULL))`);
        await queryRunner.query(`ALTER TABLE "ecom_facturas" ADD CONSTRAINT "CHK_ecom_facturas_origen" CHECK (("ordenId" IS NOT NULL) <> ("reservaExternaId" IS NOT NULL))`);
        await queryRunner.query(`ALTER TABLE "catalogo_externo_categorias" ADD CONSTRAINT "FK_664fb28bd6da1b766079f18736e" FOREIGN KEY ("catalogoId") REFERENCES "catalogo_externo"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "catalogo_externo" ADD CONSTRAINT "FK_a699077001e55c72072a4f4854c" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reservas_externas" ADD CONSTRAINT "FK_5345810031dfa6374555e62cef9" FOREIGN KEY ("clienteId") REFERENCES "ecom_clientes"("clienteId") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reservas_externas" ADD CONSTRAINT "FK_d51c36e5782d7991eed429ed1e9" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reservas_externas" ADD CONSTRAINT "FK_2aeccd97871812e7bd8106df16d" FOREIGN KEY ("catalogoId") REFERENCES "catalogo_externo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reservas_externas" ADD CONSTRAINT "FK_eed08c76e8df5e62d53e64dd10a" FOREIGN KEY ("datosFacturacionId") REFERENCES "ecom_datos_facturacion"("datosFacturacionId") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ecom_pagos" ADD CONSTRAINT "FK_3f6dcf9a549b843247a553f6de9" FOREIGN KEY ("ofertaId") REFERENCES "ecom_ofertas"("ofertaId") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ecom_pagos" ADD CONSTRAINT "FK_a6c26390f26d08746efff4f0f00" FOREIGN KEY ("reservaExternaId") REFERENCES "reservas_externas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "proveedor_salud" ADD CONSTRAINT "FK_b90e34d1c46b727f041013a3aaa" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ecom_facturas" ADD CONSTRAINT "FK_55123faa63aed0ae13ef2aac1b9" FOREIGN KEY ("ordenId") REFERENCES "ecom_ordenes"("ordenId") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ecom_facturas" ADD CONSTRAINT "FK_1c8b1048bb913701bf1cd0279a8" FOREIGN KEY ("reservaExternaId") REFERENCES "reservas_externas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ecom_facturas" DROP CONSTRAINT "FK_1c8b1048bb913701bf1cd0279a8"`);
        await queryRunner.query(`ALTER TABLE "ecom_facturas" DROP CONSTRAINT "FK_55123faa63aed0ae13ef2aac1b9"`);
        await queryRunner.query(`ALTER TABLE "proveedor_salud" DROP CONSTRAINT "FK_b90e34d1c46b727f041013a3aaa"`);
        await queryRunner.query(`ALTER TABLE "ecom_pagos" DROP CONSTRAINT "FK_a6c26390f26d08746efff4f0f00"`);
        await queryRunner.query(`ALTER TABLE "ecom_pagos" DROP CONSTRAINT "FK_3f6dcf9a549b843247a553f6de9"`);
        await queryRunner.query(`ALTER TABLE "reservas_externas" DROP CONSTRAINT "FK_eed08c76e8df5e62d53e64dd10a"`);
        await queryRunner.query(`ALTER TABLE "reservas_externas" DROP CONSTRAINT "FK_2aeccd97871812e7bd8106df16d"`);
        await queryRunner.query(`ALTER TABLE "reservas_externas" DROP CONSTRAINT "FK_d51c36e5782d7991eed429ed1e9"`);
        await queryRunner.query(`ALTER TABLE "reservas_externas" DROP CONSTRAINT "FK_5345810031dfa6374555e62cef9"`);
        await queryRunner.query(`ALTER TABLE "catalogo_externo" DROP CONSTRAINT "FK_a699077001e55c72072a4f4854c"`);
        await queryRunner.query(`ALTER TABLE "catalogo_externo_categorias" DROP CONSTRAINT "FK_664fb28bd6da1b766079f18736e"`);
        await queryRunner.query(`ALTER TABLE "ecom_facturas" DROP CONSTRAINT "CHK_ecom_facturas_origen"`);
        await queryRunner.query(`ALTER TABLE "ecom_pagos" DROP CONSTRAINT "CHK_ecom_pagos_origen"`);
        await queryRunner.query(`DROP INDEX "IDX_ecom_pagos_oferta"`);
        await queryRunner.query(`ALTER TABLE "ecom_facturas" ALTER COLUMN "ordenId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ecom_facturas" ADD CONSTRAINT "FK_55123faa63aed0ae13ef2aac1b9" FOREIGN KEY ("ordenId") REFERENCES "ecom_ordenes"("ordenId") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ecom_pagos" ALTER COLUMN "ofertaId" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_ecom_pagos_oferta" ON "ecom_pagos" ("ofertaId", "creadoEn") `);
        await queryRunner.query(`ALTER TABLE "ecom_pagos" ADD CONSTRAINT "FK_3f6dcf9a549b843247a553f6de9" FOREIGN KEY ("ofertaId") REFERENCES "ecom_ofertas"("ofertaId") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ecom_facturas" DROP CONSTRAINT "UQ_1c8b1048bb913701bf1cd0279a8"`);
        await queryRunner.query(`ALTER TABLE "ecom_facturas" DROP COLUMN "reservaExternaId"`);
        await queryRunner.query(`ALTER TABLE "ecom_pagos" DROP COLUMN "reservaExternaId"`);
        await queryRunner.query(`DROP INDEX "IDX_proveedor_salud_proveedor"`);
        await queryRunner.query(`DROP TABLE "proveedor_salud"`);
        await queryRunner.query(`DROP INDEX "IDX_reservas_externas_owner"`);
        await queryRunner.query(`DROP INDEX "IDX_reservas_externas_proveedor"`);
        await queryRunner.query(`DROP TABLE "reservas_externas"`);
        await queryRunner.query(`DROP INDEX "IDX_catalogo_externo_tipo"`);
        await queryRunner.query(`DROP TABLE "catalogo_externo"`);
        await queryRunner.query(`DROP TABLE "catalogo_externo_categorias"`);
        await queryRunner.query(`DROP INDEX "UQ_proveedores_nombre"`);
        await queryRunner.query(`DROP TABLE "proveedores"`);
    }

}
