# Descomposición de la base de datos en microservicios

Análisis de las 61 tablas (≈82 FK) de la base normalizada (`../MODELO-DE-DATOS.md`, generado) y de las transacciones del código. Regla de corte: **la consistencia transaccional, no el número de tablas**. Dos grupos que comparten una transacción ACID no se separan sin una saga. Las cuentas de FK salen del modelo generado, no se cotejaron una a una con las migraciones.

## 1. Lo que ata hoy a los grupos
1. **Compra en una sola transacción** — `ecommerce/ordenes/compras.service.ts:175-183`: orden + reserva (`createBookingWithin`) + billetes + factura (`facturacion.emitir`) + `pagos.asociarOrden` + oferta pagada. El cobro (`autorizar`, `capturar`) queda fuera; el resto es atómico.
2. **Hold + inventario + reserva** — `services/offers.service.ts:208`, `bookings.service.ts:134,165,213`: `InventoryService` es el único escritor de `Vuelo.asientosDisponibles` y lo usan hold, reserva, cancelación y cambio de fecha.
3. **Ciclo de FK** `ecom_pagos → ecom_ordenes → ecom_ofertas ← ecom_pagos`, más el CHECK «oferta/orden XOR reserva_externa» en `ecom_pagos` y `ecom_facturas`.
4. **Concentradores de FK**: `ecom_mercados` (clientes, órdenes, pagos, notificaciones, auditoría) y `ecom_clientes` (órdenes, reservas externas, auditoría administrativa).
5. **Dirección única**: el núcleo GDS no importa nada del e-commerce; el e-commerce entra al núcleo con 6 FK (`holdId`, `bookingId`, `vueloId` ×2, `fare_family` ×2).
6. **Gateway GraphQL** lee repositorios de facturas, órdenes, reservas externas y auditoría (`gateway/gateway.service.ts:85-97,166-206`): no se separa sin pasar a llamadas por API.

## 2. Grupos y veredicto
| # | Grupo | Tablas | FK a romper | Qué lo impide | Dificultad |
|---|---|---|---|---|---|
| 1 | Auditoría y observabilidad | `auditoria_transacciones`, `auditoria_sagas`, `auditoria_saga_pasos`, `peticiones_http` | `auditoria_transacciones.mercado` → código | El gateway lee sus tablas; las sagas escriben pasos en proceso | Baja |
| 2 | Webhooks | `vuelos_webhook_subscriptions`, `_subscription_events`, `_deliveries` | ninguna | Solo el bus en proceso (`booking.*`, `flight.*`) | Baja |
| 3 | Notificaciones | `ecom_notificaciones`, `ecom_plantillas_notificacion` | `mercado` → código | Ya consume eventos; falta quitar `MercadosModule` | Baja |
| 4 | Identidad | `ecom_clientes`, `ecom_cliente_roles`, `ecom_roles` | `ordenes.clienteId`, `reservas_externas.clienteId`, `auditoria_administrativa.actorId` → id lógico | `mercadoPreferido`; el id ya viaja en el JWT (`sub`) | Media |
| 5 | Proveedores / integración | `proveedores`, `proveedor_salud`, `catalogo_externo`, `categorias` | ninguna hacia fuera | Jobs de salud y circuit breakers en memoria | Media |
| 6 | Reservas externas | `reservas_externas` | `clienteId`, `datosFacturacionId`; CHECK en pagos y facturas | Depende de Pagos y Facturación | Alta |
| 7 | Facturación | `ecom_datos_facturacion`, `ecom_facturas`, `ecom_factura_detalles` | `ordenId`, `reservaExternaId` → ids lógicos | `emitir` recalcula totales desde la oferta dentro de la transacción de compra (`facturacion.service.ts:28-54`) | Alta |
| 8 | Pagos | `ecom_pagos`, `ecom_pago_antifraude_motivos` | `ofertaId`, `ordenId`, `reservaExternaId` | `asociarOrden` dentro de la transacción; ciclo con órdenes | Alta |
| 9 | Postventa y check-in | `baggage_purchases`, `check_ins`, `date_change_offers`, `cancellation_quotes` | 10 FK a vuelos/bookings/passengers | Escribe inventario y reembolsa vía Pagos | Alta (saga) |
| 10 | Catálogo e inventario | `vuelos`, `aerolineas`, `fare_families` (+ contador de asientos) | `vuelos → ecom_localidades` | El contador lo escriben hold, reserva y postventa | Alta |
| 11 | Reserva (hold + booking + billetes) | `flight_offers`, `offer_itineraries`, `flight_holds`, `hold_items`, `bookings`, `passengers`, `tickets`, `seat_assignments`, `booking_cambios` | `ofertas.holdId`, `ordenes.bookingId`, `*.vueloId` | Consumo del hold y creación de asientos en una transacción | Muy alta |
| — | No es servicio | `idempotency_records`; `ecom_mercados` + 10 tablas de configuración | — | Infraestructura transversal / datos de referencia (replicar como configuración de solo lectura) | — |

## 3. Propuesta de fronteras
- **Vuelos GDS** = 9 + 10 + 11: catálogo, inventario, hold, reserva, postventa, check-in. Comparten transacciones; se quedan juntos.
- **Comercial** = ofertas, órdenes, pagos, facturación (ciclo de FK y transacción de compra internos). Se separa del GDS al final, con saga.
- **Satélites extraíbles primero**: 1 Auditoría, 2 Webhooks, 3 Notificaciones, 4 Identidad, 5 Proveedores (en ese orden).

## 4. Prerrequisitos antes de cortar
1. **Contratos de evento** versionados y validados (hecho en esta ronda: [CONTRATOS-DE-EVENTOS.md](CONTRATOS-DE-EVENTOS.md)).
2. **Outbox transaccional**: hoy se publica tras el commit y la reconciliación re-anuncia; un microservicio necesita que evento y cambio de estado salgan juntos.
3. **FK entre servicios → ids o códigos lógicos**, con validación en la aplicación. Las FK se mantienen dentro de cada servicio.
4. **Un esquema PostgreSQL por servicio** en la misma instancia primero; instancias separadas después.
5. **Instantánea en el evento de orden** para Facturación (hoy recalcula desde la oferta).
6. **El gateway deja de leer repositorios ajenos** y llama por API/ESB.
7. **Replicar `mercados`** como configuración de solo lectura en cada servicio.

## 5. Fases
- **A (hecha)**: contratos y EDA conformes a las semanas 6–7, dentro del monolito.
- **B**: esquemas por servicio + outbox para Auditoría, Webhooks y Notificaciones.
- **C**: primer microservicio real (aplicación Nest separada que consume de RabbitMQ), empezando por Auditoría.
- **D (opcional)**: Identidad y Proveedores; separar GDS y Comercial con saga Reserva → Emisión.

Las fases B–D están documentadas, no ejecutadas.
