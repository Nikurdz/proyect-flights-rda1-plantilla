# ecommerce/observabilidad/ — Auditoría de eventos, sagas y peticiones HTTP

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `auditoria-transacciones.service.ts` | Guarda cada evento de dominio (solo ids, único por id de evento) |
| `sagas-registro.service.ts` | Registra los pasos de la saga de compra (nunca la rompe) |
| `peticiones-http.service.ts` | Muestra acotada de peticiones, escrita por lotes |
| `retencion-auditoria.service.ts` | Purga tras `AUDIT_RETENTION_DAYS` (180) con la compuerta de inactividad |
| `auditoria-cambio.subscriber.ts` | Rellena `correlationId`/IP/user agent en cambios admin |
| `entities/auditoria.entity.ts` | Entidades de las tablas de abajo |
| `observabilidad.module.ts` | Módulo Nest |

## Tablas
`auditoria_transacciones`, `auditoria_sagas`, `auditoria_saga_pasos`, `peticiones_http` (purga `HTTP_LOG_RETENTION_DAYS`, 7) y `auditoria_administrativa` (cambios admin).

## Cómo se conecta
Alimenta la trazabilidad y las métricas de [../admin/](../admin/README.md). `acceso.*`, `oauth2.*`, `webhook.*` y `llamada.*` entran por `registrarAccion` (`../../common/traza-acciones.ts`). Los proveedores quedan fuera ([../integracion/](../integracion/README.md)).

## Cuaderno y auditorías
Semana 10: [cuaderno](../../docs/RDA2-docs/auditorias/RETO-2-CUADERNO/README.md). Auditoría C11: [índice](../../docs/RDA2-docs/auditorias/README.md).

## Más a fondo
[ecommerce](../README.md) · [módulo vuelos](../../README.md) · [Modelo de datos](../../docs/MODELO-DE-DATOS.md)

← Volver a [../README.md](../README.md)
