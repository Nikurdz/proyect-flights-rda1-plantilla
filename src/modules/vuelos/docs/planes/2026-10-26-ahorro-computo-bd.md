# Plan de implementación: ahorro de cómputo de la base de datos y traslado a Aiven

- **Fecha:** 2026-10-26
- **Agente:** Claude Code Desktop
- **Área:** backend/BD
- **Rama:** `vuelos`

## Objetivo
Neon (plan Free) agotó su cupo de cómputo (110 CU-hrs usados) y dejó la API sin base de datos. Que la API vuelva a funcionar sin pagar y que no consuma cómputo cuando nadie la usa.

## Causa
Neon apaga el cómputo tras 5 min sin consultas (no configurable en Free), pero la API consultaba la base cada 60 s (webhooks, salud de proveedores), 5 min (barredor de holds, reconciliación) y con cada sonda de salud: nunca dormía (~84 % del tiempo encendido).

## Alcance
- Incluye: puerta de actividad para las tareas de fondo, ruta de salud sin base de datos, pool y TLS configurables, guía para Aiven.
- No incluye: crear cuentas ni tocar Railway, Netlify o Neon (los hace el usuario).

## Cambios
| Archivo | Cambio |
|---|---|
| `common/activity-gate.ts` | `touch()` / `isActive()`; ventana `APP_IDLE_MS` (10 min por defecto, mínimo 1 min) |
| `common/correlation.ts`, `common/domain-event-bus.ts` | una petición real o un evento cuenta como uso; las sondas `/health*` no |
| `webhook-dispatcher`, `holds-sweeper`, `reconciliacion`, `salud-proveedores`, `peticiones-http` (purga) | el tick no consulta la base si la puerta está inactiva |
| `ecommerce/admin/observabilidad.controller.ts` | `GET /api/v1/health/live`: 200 sin tocar la base (`GET /health` sigue comprobándola) |
| `src/app.module.ts` | pool `DB_POOL_MAX` (5 por defecto, Aiven permite 20) y `DB_SSL_CA` opcional |
| `render.yaml` | `healthCheckPath: /api/v1/health/live` |

## Impacto en la API / contrato
Ruta nueva `GET /health/live`; contrato regenerado (75 rutas, 86 operaciones).

## Riesgos y decisiones
- Un reintento de webhook o una reconciliación pendiente espera a la siguiente visita (se ponen al día en ≤ 1 min tras ella). Aceptado para una demo.
- Un monitor externo que llame a `/health` o a rutas de negocio mantiene la base despierta: usar solo `/health/live`.
- Aiven: 1 GB, 20 conexiones, sin pooler; se parte de una base nueva (los datos de Neon no se pueden exportar con el cupo agotado).

## Verificación
- 289 pruebas, `lint`, `build` (`dist/main.js` sigue existiendo).
- Medición real con la API compilada: con la puerta inactiva, 45 s sin ninguna transacción de la aplicación en la base; tras una petición vuelve la actividad.
