# Plan de implementación: dashboard de gestión del administrador

- **Fecha:** 2026-10-07
- **Agente:** Claude Code Desktop (backend) y Antigravity (UI)
- **Área:** backend y frontend
- **Rama:** `vuelos`

## Objetivo
Un panel de gestión más completo para el ADMIN, con indicadores y gráficas de lo que importa para operar el negocio: ventas, conversión, rutas, ocupación, posventa e integración.

## Alcance
- Incluye: `GET /admin/dashboard?dias=7|30|90` (agregados desde la base, sin datos personales, caché de 15 s) y una página «Dashboard» en el panel con KPIs y gráficas.
- No incluye: exportación a CSV/PDF, filtros por ruta o por aerolínea, ni métricas en tiempo real (esas siguen en Observabilidad → En vivo).

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `ecommerce/admin/dashboard.service.ts` y `dashboard.controller.ts` | Cálculo de KPIs, serie diaria (un punto por día UTC), embudo, reparto por estado, top de rutas, ocupación por ruta, posventa y webhooks. |
| `ecommerce/admin/admin.module.ts` | Registro del controlador y el servicio. |
| `testing/ecommerce.integration.spec.ts` | Pruebas de acceso (401/403), validación de la ventana y coherencia de las cifras con la base. |
| `frontend/` | Página y gráficas del dashboard. |

## Impacto en la API / contrato
Ruta nueva solo del e-commerce/administración (no forma parte de `vuelos-openapi.yaml`): `GET /api/v1/admin/dashboard`, rol ADMIN.

## Pasos
1. Backend y pruebas. 2. UI con gráficas. 3. Documentación.

## Riesgos y decisiones abiertas
- La serie usa días UTC; en Ecuador (UTC−5) las ventas de la noche cuentan para el día siguiente.
- Las consultas agregan sobre `ecom_ordenes`, `vuelos_bookings`, `vuelos` y otras; con mucho volumen habría que añadir índices o una tabla de resumen.

## Verificación
`npm test` con `TEST_DATABASE_URL`, `npm run build`, build y tests del frontend, y revisión visual del panel con datos de demostración.
