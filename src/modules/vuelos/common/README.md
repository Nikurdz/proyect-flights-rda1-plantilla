# common — utilidades y reglas del dominio de Vuelos

Los `*.spec.ts` junto a cada archivo son sus pruebas unitarias.

## Qué hay aquí

| Tema | Archivos |
|---|---|
| Configuración | `vuelos-config.ts` (valida el entorno al arrancar: `POSTSALE_*`, `CHECKIN_*`, `WEBHOOKS_*`…), `service-role.ts` (`SERVICE_ROLE`), `activity-gate.ts` (jobs en pausa si no hay uso), `db-ssl.ts`, `db-errors.ts` |
| Tiempo y zonas horarias | `date.util.ts` (días de Ecuador/aeropuerto), `zoned-time.ts`, `airport-zones.ts` |
| Dinero | `money.util.ts` (enteros en unidades menores), `pricing.util.ts`, `bigint.transformer.ts` |
| Eventos y esquemas | `domain-event-bus.ts`, `event-schemas.ts`, `schema-compat.ts`, `cloud-events.ts` |
| Seguridad y cifrado | `cifrado.ts` (AES-256-GCM, índice ciego), `ticket-qr.ts` (QR firmado), `safe-http.ts` (anti-SSRF), `travellers.ts` |
| Trazabilidad y observabilidad | `correlation.ts`, `traza-acciones.ts`, `topologia.ts`, `runtime-metrics.ts`, `winston-logger.ts` |
| Errores ProblemDetails | `problem-details.exception.ts`, `problem-details.filter.ts`, `problem-controller.ts`, `api-problem-responses.ts`, `swagger-tags.ts` |
| Asientos y holds | `held-seats.ts`, `hold-loader.ts`, `seat-rules.ts`, `seat-grid.ts` |
| Reglas de negocio | `business-rules.ts` (edades, ratios), `postsale-rules.ts` (cargos y plazos), `cursor.util.ts` |

## Cómo se conecta

- Lo importan `../services/`, `../v2/` y `../ecommerce/`. `topologia.spec.ts` falla si un evento o paso de saga no tiene origen/destino.
- Cada evento publicado necesita su JSON Schema en `contracts/eventos/`.

## Más a fondo

- [Contratos de eventos](../docs/RDA2-docs/CONTRATOS-DE-EVENTOS.md) · [contracts/eventos](../../../../contracts/eventos/README.md) · [observabilidad](../ecommerce/observabilidad/README.md)

← Volver a [vuelos](../README.md)
