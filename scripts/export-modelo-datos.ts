/**
 * Generates src/modules/vuelos/docs/MODELO-DE-DATOS.md from the TypeORM metadata of the entities (tables, columns,
 * keys, foreign keys), so the document cannot drift from the schema. It connects to DATABASE_URL only to build the
 * metadata; nothing is read or written there.
 *
 *   npm run docs:modelo
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config({ quiet: true });

type Dominio = 'gds' | 'ecom' | 'integ' | 'obs';

const DOMINIOS: Record<Dominio, string> = {
  gds: 'Núcleo de vuelos (GDS)',
  ecom: 'E-commerce R1',
  integ: 'Integración con proveedores',
  obs: 'Observabilidad y auditoría',
};

// What each table is for. A table missing here fails the generation, so a new entity cannot go undocumented.
const PROPOSITO: Record<string, string> = {
  vuelos: 'Vuelo programado: número, ruta, horario, tarifa base e inventario de asientos',
  vuelos_aerolineas: 'Aerolíneas por código IATA',
  vuelos_fare_families: 'Familias tarifarias (BASIC, LIGHT, FULL)',
  vuelos_flight_offers: 'Oferta de búsqueda con precio total y composición del grupo',
  vuelos_flight_offer_itineraries: 'Tramos de cada oferta de búsqueda (id de itinerario → vuelo)',
  vuelos_flight_holds: 'Bloqueo temporal de cupos con precio congelado',
  vuelos_flight_hold_items: 'Tramos de cada bloqueo: vuelo vigente, asientos, cabina y familia',
  vuelos_bookings: 'Reserva emitida (PNR) con estado y total',
  vuelos_booking_cambios: 'Historial de cambios de una reserva (cambio de fecha, reprogramación, cancelación)',
  vuelos_passengers: 'Pasajeros de la reserva (datos personales cifrados)',
  vuelos_tickets: 'Billete electrónico por pasajero',
  vuelos_seat_assignments: 'Asientos asignados; la clave única (vuelo, asiento) impide venderlo dos veces',
  vuelos_baggage_purchases: 'Equipaje extra comprado por pasajero y tramo',
  vuelos_date_change_offers: 'Opciones cotizadas de cambio de fecha',
  vuelos_cancellation_quotes: 'Cotizaciones de cancelación (reembolso y penalidad)',
  vuelos_check_ins: 'Check-in por pasajero y vuelo con grupo y posición de abordaje',
  vuelos_webhook_subscriptions: 'Suscriptores de eventos de reserva (secreto cifrado)',
  vuelos_webhook_subscription_events: 'Tipos de evento que recibe cada suscripción',
  vuelos_webhook_deliveries: 'Cola de entregas de webhooks con reintentos',
  vuelos_idempotency_records: 'Respuestas guardadas por clave de idempotencia (documento opaco)',
  ecom_mercados: 'Mercado de venta: país, moneda, tipo de cambio, razón social, versión',
  ecom_mercado_idiomas: 'Idiomas del portal por mercado',
  ecom_mercado_productos: 'Pestañas del buscador por mercado',
  ecom_mercado_identificaciones: 'Tipos de identificación fiscal aceptados y su patrón',
  ecom_mercado_documentos_legales: 'Términos, privacidad y condiciones de transporte (versión y URL)',
  ecom_mercado_medios_pago: 'Medios de pago del mercado',
  ecom_mercado_medio_marcas: 'Marcas de tarjeta aceptadas por medio de pago',
  ecom_mercado_medio_cuotas: 'Planes de cuotas por medio de pago',
  ecom_mercado_medio_productos: 'Para qué se puede usar el medio de pago (pasaje, adicional)',
  ecom_mercado_reglas: 'Ventanas regulatorias (retracto, desistimiento, traspaso)',
  ecom_mercado_regla_familias: 'Familias tarifarias a las que aplica el desistimiento',
  ecom_roles: 'Catálogo de roles (CUSTOMER, ADMIN)',
  ecom_clientes: 'Cuentas de cliente (credenciales con hash, bloqueo por intentos)',
  ecom_cliente_roles: 'Roles de cada cuenta',
  ecom_localidades: 'Catálogo de aeropuertos y ciudades por código IATA',
  ecom_datos_facturacion: 'Identidad de facturación (cifrada); la comparten oferta, orden y factura',
  ecom_ofertas: 'Oferta de compra: estado, total, grupo, contacto cifrado, bloqueo de cupos',
  ecom_oferta_trayectos: 'Tramos cotizados de la oferta (vuelo y familia)',
  ecom_oferta_trayecto_precios: 'Precio base e impuestos por tipo de pasajero y tramo',
  ecom_oferta_pasajeros: 'Pasajeros de la oferta (datos personales cifrados)',
  ecom_oferta_pasajero_necesidades: 'Necesidades especiales de cada pasajero',
  ecom_oferta_pasajero_asientos: 'Asientos elegidos por pasajero y vuelo',
  ecom_aceptaciones_condiciones: 'Versiones de términos aceptadas al comprar',
  ecom_ordenes: 'Orden de compra: número, estado, PNR, reserva, facturación, contacto cifrado',
  ecom_orden_historial: 'Historial de estados de la orden',
  ecom_pagos: 'Pagos: autorización, captura, anulación y reembolso (monto en unidades menores)',
  ecom_pago_antifraude_motivos: 'Motivos del motor antifraude por pago',
  ecom_facturas: 'Factura de cada orden emitida (subtotal, IVA, total)',
  ecom_factura_detalles: 'Líneas de la factura: tramo y tipo de pasajero',
  ecom_notificaciones: 'Mensajes enviados con resultado e intentos (cuerpo cifrado)',
  ecom_plantillas_notificacion: 'Plantillas versionadas por tipo, mercado e idioma',
  auditoria_administrativa: 'Bitácora de cambios del back-office (antes y después)',
  auditoria_transacciones: 'Eventos de dominio que pasaron por el bus (solo identificadores)',
  auditoria_sagas: 'Ejecuciones de sagas con su resultado',
  auditoria_saga_pasos: 'Pasos de cada saga y su duración',
  peticiones_http: 'Muestra acotada del tráfico HTTP (se purga por antigüedad)',
  proveedores: 'Servicios de otros equipos con los que se integra la plataforma (kill-switch en `activo`)',
  proveedor_salud: 'Historial de comprobaciones de cada proveedor: estado y latencia',
  catalogo_externo: 'Productos del proveedor importados con «sincronizar» (lo que ven los clientes)',
  catalogo_externo_categorias: 'Categorías de cada producto externo',
  reservas_externas: 'Reservas de productos de un proveedor pagadas y facturadas aquí (datos del comprador cifrados)',
};

const dominioDe = (tabla: string): Dominio =>
  tabla.startsWith('vuelos') ? 'gds' : tabla.startsWith('ecom_') ? 'ecom' : /^(proveedor|catalogo_externo|reservas_externas)/.test(tabla) ? 'integ' : 'obs';

async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [join(__dirname, '..', 'src', 'modules', 'vuelos', '**', '*.entity.ts')],
    synchronize: false,
  });
  await dataSource.initialize();

  const tablas = dataSource.entityMetadatas.filter((m) => m.tableType === 'regular').sort((a, b) => a.tableName.localeCompare(b.tableName));
  const sinDoc = tablas.filter((t) => !PROPOSITO[t.tableName]).map((t) => t.tableName);
  if (sinDoc.length > 0) throw new Error(`Add a purpose in PROPOSITO for: ${sinDoc.join(', ')}`);

  const fks = tablas.flatMap((t) =>
    t.foreignKeys.map((fk) => ({
      hijo: t.tableName,
      padre: fk.referencedEntityMetadata.tableName,
      columnas: fk.columnNames.join(', '),
      borrado: fk.onDelete ?? 'NO ACTION',
      opcional: fk.columns.every((c) => c.isNullable),
      unica: fk.columns.length === 1 && (fk.columns[0].isPrimary && t.primaryColumns.length === 1 || t.uniques.some((u) => u.columns.length === 1 && u.columns[0] === fk.columns[0]) || t.indices.some((i) => i.isUnique && i.columns.length === 1 && i.columns[0] === fk.columns[0])),
    })),
  );

  const lineas: string[] = [];
  const out = (s = ''): void => void lineas.push(s);

  out('# Modelo de datos — módulo Vuelos');
  out();
  out(`> Generado por \`npm run docs:modelo\` desde las entidades TypeORM: no se edita a mano.`);
  out();
  out(
    `Esquema **real** de PostgreSQL (${tablas.length} tablas, ${fks.length} llaves foráneas) versionado con migraciones (\`src/modules/vuelos/migrations/\`). Está en **tercera forma normal**: cada dato vive en una sola tabla, los arreglos y documentos se modelan como tablas hijas y toda relación es una \`FOREIGN KEY\` real.`,
  );
  out();
  out('Reglas del modelo:');
  out();
  out('- **Dinero** en unidades menores enteras (`*Minor`, `bigint`); los textos decimales solo existen en la frontera de la API.');
  out('- **Sin copias**: la orden no repite el viaje. Sus tramos salen del bloqueo de cupos de la reserva (o de la oferta si nunca se emitió), sus pasajeros de la oferta, su facturación es la fila compartida `ecom_datos_facturacion`.');
  out('- **Datos personales cifrados** (AES-256-GCM, prefijo `v1:`) campo por campo: nombres, apellidos, nacimiento, documento, contacto, facturación, cuerpo de notificaciones y secreto de webhook. No se consultan por SQL: se busca por columnas en claro (número de orden, PNR) y el apellido se compara en la aplicación.');
  out('- **Sin llave foránea a propósito**: `ownerId` (el `sub` verificado del JWT: cliente o invitado `guest:<id>`, que no es una fila) y las claves de idempotencia. Los documentos opacos (`payload`, `responseBody`, `antes`, `despues`) no son datos relacionales.');
  out('- **Integridad que no puede expresar una FK**: el inventario se descuenta con `UPDATE` condicional, la reserva bloquea la fila del hold y la clave única `(vueloId, seatNumber)` impide vender un asiento dos veces.');
  out();

  out('## 1. Diagrama entidad-relación');
  out();
  out('Solo relaciones (la columna de la llave foránea va en la etiqueta); las columnas están en el diccionario de la sección 2.');
  out();
  for (const dominio of Object.keys(DOMINIOS) as Dominio[]) {
    const del = fks.filter((f) => dominioDe(f.hijo) === dominio);
    if (del.length === 0) continue;
    out(`### ${DOMINIOS[dominio]}`);
    out();
    out('```mermaid');
    out('erDiagram');
    for (const f of del) out(`    ${f.padre} ||--${f.unica ? 'o|' : 'o{'} ${f.hijo} : "${f.columnas}"`);
    out('```');
    out();
  }

  out('## 2. Diccionario de tablas');
  for (const dominio of Object.keys(DOMINIOS) as Dominio[]) {
    out();
    out(`### ${DOMINIOS[dominio]}`);
    out();
    out('| Tabla | Para qué sirve | Clave | Columnas | Llaves foráneas (borrado) |');
    out('|---|---|---|---|---|');
    for (const t of tablas.filter((x) => dominioDe(x.tableName) === dominio)) {
      const pk = t.primaryColumns.map((c) => c.databaseName).join(' + ');
      const columnas = t.columns
        .filter((c) => !c.isPrimary)
        .map((c) => `\`${c.databaseName}\``)
        .join(', ');
      const claves = fks
        .filter((f) => f.hijo === t.tableName)
        .map((f) => `\`${f.columnas}\` → \`${f.padre}\` (${f.borrado === 'CASCADE' ? 'cascada' : f.borrado === 'RESTRICT' ? 'restringe' : f.borrado})`)
        .join('; ');
      out(`| \`${t.tableName}\` | ${PROPOSITO[t.tableName]} | \`${pk}\` | ${columnas || '—'} | ${claves || '—'} |`);
    }
  }

  out();
  out('## 3. Estados principales');
  out();
  out('- **Reserva** (`vuelos_bookings.status`): `PENDING` → `CONFIRMED` → `CHANGE_PENDING` / `CANCELLATION_PENDING` → `CANCELLED`; `FAILED`.');
  out('- **Bloqueo** (`vuelos_flight_holds.status`): `HELD` → `CONSUMED` / `EXPIRED` / `RELEASED`.');
  out('- **Oferta** (`ecom_ofertas.estado`): `ABIERTA` → `EN_REVISION_PRECIO` / `EN_PAGO` → `PAGADA`; `VENCIDA`, `CANCELADA`.');
  out('- **Orden** (`ecom_ordenes.estado`): `PENDIENTE_PAGO` → `PAGADA` → `EMITIDA` → `MODIFICADA` / `DEVOLUCION_EN_CURSO` → `REEMBOLSADA`; `FALLIDA_COMPENSADA`, `EXPIRADA`. Cada cambio queda en `ecom_orden_historial`.');
  out('- **Pago** (`ecom_pagos.estado`): `AUTORIZADO` → `CAPTURADO` → `REEMBOLSADO`; `ANULADO`, `RECHAZADO_*`, y los pendientes que reintenta el reconciliador.');
  out('- **Saga** (`auditoria_sagas.estado`): `EN_CURSO` → `COMPLETADA` / `COMPENSADA` / `FALLIDA`.');
  out();
  out('## 4. Cómo regenerar o comprobar este modelo');
  out();
  out('```bash');
  out('npm run docs:modelo                 # reescribe este archivo desde las entidades');
  out('npm run migration:generate:vuelos -- src/modules/vuelos/migrations/NombreCambio   # migración a partir de un cambio de entidad');
  out('npm run migration:check:vuelos      # debe salir con código 0 si las migraciones reproducen las entidades');
  out('```');
  out();
  out('Cualquier cambio de entidad exige su migración. La migración `NormalizeSchema` (1792970623866) llevó el esquema anterior (sin llaves foráneas, con arreglos y documentos `jsonb`) a este modelo conservando los datos; es de un solo sentido, así que se hace copia de la base antes de aplicarla.');

  writeFileSync(join(__dirname, '..', 'src', 'modules', 'vuelos', 'docs', 'MODELO-DE-DATOS.md'), lineas.join('\n') + '\n');
  await dataSource.destroy();
  console.log(`MODELO-DE-DATOS.md: ${tablas.length} tablas, ${fks.length} llaves foráneas.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
