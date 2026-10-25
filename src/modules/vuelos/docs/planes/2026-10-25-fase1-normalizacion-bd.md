# Plan de implementación: base de datos normalizada (3FN) con llaves foráneas, facturación y auditoría

- **Fecha:** 2026-10-25
- **Agente:** Claude Code Desktop
- **Área:** backend/BD
- **Rama:** `vuelos`

## Objetivo
Dejar la base de datos en tercera forma normal con llaves foráneas reales, añadir las tablas de facturación y de observabilidad que pide la arquitectura por capas, y migrar los datos existentes sin perderlos.

## Alcance
- Incluye: normalizar el núcleo GDS y el e-commerce, tablas de factura, auditoría de eventos y sagas, bitácora acotada de peticiones, migración con relleno de datos, modelo de datos generado.
- No incluye: tablas de proveedores externos (`proveedores`, `proveedor_salud`, `catalogo_externo`, `reservas_externas`), que llegan con la Fase 2 en su propia migración; RabbitMQ, GraphQL y el orquestador genérico (Fase 3); pantallas (Fase 4).

## Contexto y referencias
Plan general: `C:\Users\david\.claude\plans\open-and-read-levantamiento-requerimient-expressive-plum.md` (Fase 1). Antes no existía ninguna llave foránea y había arreglos y `jsonb` con datos relacionales (`ecom_ordenes.trayectos/pasajeros/historial`, `vuelos_flight_holds.inventory`, `ecom_mercados.*`…).

## Cambios previstos y realizados
| Antes | Ahora |
|---|---|
| `vuelos.aerolinea` repetida en cada vuelo; IATA sueltas | `vuelos_aerolineas(codigo, nombre)`; FK de `vuelos` a la aerolínea y a `ecom_localidades` |
| Ofertas de búsqueda con `itineraries[]`, `passengersBreakdown`, total en texto | `vuelos_flight_offer_itineraries`, cuatro columnas del grupo, `grandTotalMinor` |
| Holds con `inventory[]`, `itinerarySelections[]`, precio en texto | `vuelos_flight_hold_items` (vuelo vigente, asientos, cabina, familia), `lockedPriceMinor`; desaparecen las consultas `inventory @> jsonb` |
| Reserva con ruta copiada, `changes[]`, total en texto | la ruta sale de los tramos del hold; `vuelos_booking_cambios`; `totalMinor` |
| Suscripción de webhook con `events[]` | `vuelos_webhook_subscription_events` |
| Mercado con arreglos y documentos | idiomas, productos, medios de pago (+marcas, cuotas, productos), identificaciones fiscales, documentos legales, reglas regulatorias (+familias) |
| Cliente con `roles text[]` | `ecom_roles` + `ecom_cliente_roles` |
| Oferta con `trayectos`, `datosPasajeros`, `facturacion`, `condicionesAceptadas` | trayectos y precios por tipo de pasajero, pasajeros (+necesidades, asientos), `ecom_datos_facturacion`, `ecom_aceptaciones_condiciones` |
| Orden que copiaba trayectos, pasajeros, pago, facturación y condiciones | la orden no copia nada: tramos del hold, pasajeros de la oferta, pago por `ordenId`, facturación compartida; `ecom_orden_historial` |
| Pago con `medio` y `antifraude` en `jsonb` | `marca`, `ultimos4`, veredicto y puntaje; `ecom_pago_antifraude_motivos` |
| (no existía) | `ecom_facturas` + `ecom_factura_detalles`, emitidas en la misma transacción que la orden |
| (no existía) | `auditoria_transacciones`, `auditoria_sagas` + `auditoria_saga_pasos`, `peticiones_http`; `ecom_auditoria_cambios` pasa a `auditoria_administrativa` |
| Sin FK en el resto | FK reales en pasajeros, billetes, asientos, equipaje, check-in, cambios de fecha, cotizaciones, entregas de webhook, clientes→mercado, notificaciones y plantillas→mercado, auditoría→cliente |

## Impacto en la API / contrato
Ninguno: las respuestas conservan su forma (la vista se arma con consultas por lote). `contracts/vuelos-ecommerce-openapi.yaml` no cambia y su prueba sigue en verde.

## Pasos
1. Bloque A (núcleo GDS) y Bloque B (ventas: ofertas, órdenes, pagos, facturación) con las pruebas en verde en cada uno.
2. Bloque C (mercados, roles, aerolíneas, eventos de webhook, FKs restantes).
3. Bloque D (auditoría, sagas, bitácora HTTP con purga).
4. Bloque E: migración `NormalizeSchema` (DDL generado por TypeORM + relleno), `migration:check` en 0, `MODELO-DE-DATOS.md` generado.

## Riesgos y decisiones
- **Migración de un solo sentido** (`down` lanza error): hacer copia de la base antes de aplicarla en Neon. Necesita `DATA_ENCRYPTION_KEY` en producción para volver a cifrar los datos personales campo por campo.
- Un hold cuya oferta de búsqueda ya se había purgado recibe una oferta reconstruida desde el propio hold, para que la FK se cumpla. Un tramo que apunta a un vuelo ya borrado se descarta.
- Las órdenes antiguas cuya cotización no cuadra con lo cobrado quedan sin factura (la migración avisa con el número).
- El `down` no se implementa por pérdida de datos inevitable; la reversión es restaurar la copia.

## Verificación
- 256 pruebas (unitarias + integración con `TEST_DATABASE_URL`), `npm run lint` y `npm run build` en cero errores.
- La migración se probó sobre siete bases con el **esquema anterior y datos generados por el código anterior** (compras, posventa, webhooks, administración): todas migran; `migration:check` da "No changes"; con la app nueva se leyeron 28 órdenes por la API, los pasajeros de la oferta coinciden (descifrados) con los de la reserva y 23 facturas suman lo cobrado. También desde una base vacía: migraciones + check + seed.
