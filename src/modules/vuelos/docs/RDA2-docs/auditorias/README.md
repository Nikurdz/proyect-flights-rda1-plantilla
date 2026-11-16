# Auditorías de RDA2 — índice

Una auditoría preparada por cada plan importante de RDA2, lista para transcribir. Cada archivo trae la cabecera rellena con datos de git (commits, fechas, estadísticas, archivos), el alcance, comprobaciones sugeridas por nivel de severidad dentro de la sección 2 (preguntas, no hallazgos) y las pruebas existentes y a repetir. **Los hallazgos están vacíos**: se completan al transcribir cada auditoría según la fecha de su plan.

Estructura común: la plantilla oficial de 5 secciones, en el estilo de las auditorías antiguas del proyecto (`../../RDA1-docs/AUDITORIA-10-6-2026-Backend.md`). La plantilla vacía es [`PLANTILLA-AUDITORIA.md`](PLANTILLA-AUDITORIA.md) y cada archivo sigue estas secciones:

1. Resumen ejecutivo.
2. Hallazgos críticos, altos, medios y bajos (2.1 Críticos, 2.2 Altos, 2.3 Medios, 2.4 Bajos, 2.5 Revisado y sin hallazgo).
3. Evidencia concreta indicando archivo y elemento afectado.
4. Recomendación de corrección para cada hallazgo.
5. Pruebas que deberían repetirse después de corregir (5.1 existentes, 5.2 a repetir).

`AUDITORIA-2026-11-11.md` es de otra sesión y no se modifica.

> Las fechas son las del autor en git (día local); RDA2 empieza el 2026-10-26 (commit `704956f`).

## Índice (por fecha)

| N.º | Fecha | Tema | Archivo | Planes | Commits | Estado |
|---|---|---|---|---|---|---|
| 01 | 2026-10-26 | Contratos de eventos (JSON Schema, AsyncAPI) y división en microservicios | [`AUDITORIA-2026-10-26-eventos-contratos-microservicios.md`](AUDITORIA-2026-10-26-eventos-contratos-microservicios.md) | `2026-10-26-eventos-contratos-microservicios` | `704956f` | por transcribir |
| 02 | 2026-10-26 | Contrato v2 de Booking (adopción en /api/v2/vuelos) y contrato propio RAM Alliance | [`AUDITORIA-2026-10-26-contrato-v2.md`](AUDITORIA-2026-10-26-contrato-v2.md) | `2026-10-26-contrato-v2`, `2026-10-27-contrato-v2-propio` | `fa138ae`, `aeaa125`, `147d397` | por transcribir |
| 03 | 2026-10-26 | Ahorro de cómputo de la base de datos y traslado a Aiven | [`AUDITORIA-2026-10-26-ahorro-computo-bd.md`](AUDITORIA-2026-10-26-ahorro-computo-bd.md) | `2026-10-26-ahorro-computo-bd` | `05da7f0`, `8525c80`, `34d93f4`, `740697e` | por transcribir |
| 04 | 2026-11-03 | Envío de stock a Booking por HTTP | [`AUDITORIA-2026-11-03-stock-http.md`](AUDITORIA-2026-11-03-stock-http.md) | `2026-11-03-stock-http` | `911c2b0`, `9f1f698` | por transcribir |
| 05 | 2026-11-05 | Backend en Azure Container Apps (coste mínimo) | [`AUDITORIA-2026-11-05-azure-container-apps.md`](AUDITORIA-2026-11-05-azure-container-apps.md) | `2026-11-05-azure-container-apps` | `bb47941`, `cffa9bb`, `d99ceb6`, `ed3992e` | por transcribir |
| 06 | 2026-11-05 | Observaciones de Booking (plan de pruebas del 04-nov) y mostrador del back office | [`AUDITORIA-2026-11-05-observaciones-booking-y-mostrador.md`](AUDITORIA-2026-11-05-observaciones-booking-y-mostrador.md) | `2026-11-05-observaciones-booking`, `2026-11-05-mostrador-ui`, `2026-11-05-mostrador-frontend` | `22ee288`, `41ce5c1`, `a5bee7f` | por transcribir |
| 07 | 2026-11-08 | BFF por cliente (móvil, web, admin) y API Gateway local (Kong) | [`AUDITORIA-2026-11-08-bff-clientes-y-gateway.md`](AUDITORIA-2026-11-08-bff-clientes-y-gateway.md) | `2026-11-08-bff-clientes-y-gateway` | `027b470`, `30ce024` | por transcribir |
| 08 | 2026-11-08 | Preparación de la prueba de extremo a extremo con Booking | [`AUDITORIA-2026-11-08-preparacion-prueba-booking.md`](AUDITORIA-2026-11-08-preparacion-prueba-booking.md) | `2026-11-08-preparacion-prueba-booking` | `b737d23`, `bb252fe` | por transcribir |
| 09 | 2026-11-08 | Aeropuertos de Ecuador (Loja) y hora de Ecuador (UTC-5) | [`AUDITORIA-2026-11-08-aeropuertos-y-hora-ecuador.md`](AUDITORIA-2026-11-08-aeropuertos-y-hora-ecuador.md) | `2026-11-08-aeropuertos-ecuador`, `2026-11-08-hora-ecuador`, `2026-11-08-aeropuertos-ui`, `2026-11-08-aeropuertos-frontend` | `90f98f9`, `a952ac7` | por transcribir |
| 10 | 2026-11-09 | Conciliación de facturas de Booking, validaciones de edad y jóvenes (yth) | [`AUDITORIA-2026-11-09-facturacion-booking-y-edades.md`](AUDITORIA-2026-11-09-facturacion-booking-y-edades.md) | `2026-11-09-facturacion-booking-y-edades`, `2026-11-09-facturacion-booking-ui`, `2026-11-09-facturacion-booking-frontend`, `2026-11-09-edades-ui`, `2026-11-09-edades-frontend` | `bee820a`, `9bffe5a`, `9456d84` | por transcribir |
| 11 | 2026-11-09 | Trazabilidad unificada (backend y frontend) y respuestas a Booking sobre asientos y cotización | [`AUDITORIA-2026-11-09-trazabilidad-y-respuestas-booking.md`](AUDITORIA-2026-11-09-trazabilidad-y-respuestas-booking.md) | `2026-11-09-trazabilidad-frontend` | `3c8f85c`, `1a1a2e6` | por transcribir |
| 12 | 2026-11-10 | Fecha local del aeropuerto de origen, asientos apartados (HELD) por el hold y vuelos nacionales | [`AUDITORIA-2026-11-10-fecha-local-asientos-y-vuelos-nacionales.md`](AUDITORIA-2026-11-10-fecha-local-asientos-y-vuelos-nacionales.md) | `2026-11-10-fecha-local-y-asientos-held` | `7323ebe`, `eb3288d`, `1f4d2e9` | por transcribir |
| 13 | 2026-11-12 | Velocidad de la API v2, offsets reales de hora, holds reemplazables y /health sin base de datos | [`AUDITORIA-2026-11-12-booking-velocidad-y-holds.md`](AUDITORIA-2026-11-12-booking-velocidad-y-holds.md) | `2026-11-12-booking-velocidad-y-holds` | `dc25c37` | por transcribir |
| 14 | 2026-11-13 | Un contenedor por microservicio (demo local) y rediseño del frontend con heurísticas de Nielsen | [`AUDITORIA-2026-11-13-microservicios-y-rediseno-frontend.md`](AUDITORIA-2026-11-13-microservicios-y-rediseno-frontend.md) | `2026-11-13-contenedores-por-microservicio`, `2026-11-13-rediseno-frontend-nielsen` | `7e52601`, `35b0b5c`, `3c9d4b4` | por transcribir |

Auditoría ya existente de otra sesión: [`AUDITORIA-2026-11-11.md`](AUDITORIA-2026-11-11.md) (cubre el sistema completo en `1f4d2e9`; varios de sus hallazgos se citan como referencia en estos archivos).

## Leyenda de marcas

- **[V]** releído en el código por quien audita.
- **[E]** procede de una exploración y no se releyó. Todas las comprobaciones sugeridas de estos archivos llevan [E]: vienen de lecturas de exploradores, no de una relectura del auditor.
- **[observado]** visto al ejecutar o usar el sistema.
- **[confirmado en producción]** comprobado contra el despliegue real.

## Criterios de severidad

| Severidad | Criterio |
|---|---|
| Crítico | Pérdida o exposición de datos, dinero o caída de producción. |
| Alto | Fallo funcional grave, o riesgo de seguridad explotable con condiciones. |
| Medio | Defecto con solución alternativa, o deuda con impacto. |
| Bajo | Mejora, estilo o documentación. |

## Planes que no se incluyen

**Planes de RDA1 (anteriores al 2026-10-26)** — no tienen auditoría en esta carpeta (las de RDA1 están en `docs/RDA1-docs/`):

- 2026-10-05: `star-alliance-rebranding`, `revision-colores-y-navegacion-fechas`, `frontend-vuelos-ux-ui`, `revision-ux-registro-admin`
- 2026-10-06: `seleccion-de-asientos`, `fecha-vuelta-rutas-observabilidad-qr`
- 2026-10-07: `orden-del-swagger`, `posventa-checkin-webhooks`, `vuelos-llenos-demo`, `observabilidad-en-vivo`, `dashboard-admin`, `correccion-auditoria-backend`, `correccion-auditoria-frontend`
- 2026-10-08: `frontend-vuelos-agotados`, `frontend-dashboard-admin`, `admin-usuarios-vuelos-contrato`
- 2026-10-09: `frontend-admin-usuarios-vuelos`
- 2026-10-11: `eslint-y-pendientes-auditoria`, `frontend-eslint-a11y`
- 2026-10-25: `fase0-limpieza-solo-vuelos`, `fase1-normalizacion-bd`, `fase2-proveedores-externos`, `fase3-arquitectura-capas`, `frontend-proveedores-facturacion-auditoria-experiencias`

**Plan de RDA2 sin bloque propio:** `2026-10-26-frontend-cancelacion-gratis-experiencias` (plan menor de frontend del 2026-10-26; no se asignó a ningún bloque).

**Planes menores de RDA2 fusionados en un bloque:**

- 06: `2026-11-05-mostrador-ui`, `2026-11-05-mostrador-frontend`
- 09: `2026-11-08-aeropuertos-ui`, `2026-11-08-aeropuertos-frontend`, `2026-11-08-hora-ecuador`
- 10: `2026-11-09-facturacion-booking-ui`, `2026-11-09-facturacion-booking-frontend`, `2026-11-09-edades-ui`, `2026-11-09-edades-frontend`
- 02: los dos planes de contrato v2 (`2026-10-26-contrato-v2`, `2026-10-27-contrato-v2-propio`) forman un solo bloque; 14: los dos planes del 2026-11-13 forman un solo bloque.

## Notas sobre los datos

- Commits, fechas y estadísticas salen de git (solo lectura). Los bloques 03 (4 commits del 2026-10-26 anteriores a `704956f`) y 08/12 (varios commits con la misma hora de autor o muy próximos) se explican en su cabecera.
- El bloque 11 no tiene plan de backend en `docs/planes/`: enlaza el plan del frontend de trazabilidad.
- Cada archivo lista en «Por verificar» las contradicciones o dudas que dejaron los informes (por ejemplo, si Azure corría `1f4d2e9`, si `/api/docs` es accesible en producción y si `desplegar.sh` comprueba la CI). No son hechos.

## Más a fondo

- Auditorías C01-C14: los archivos `C*.md` de esta carpeta (tabla de arriba; los `AUDITORIA-2026-*.md` son las versiones previas).
- Cuaderno del Reto 2: [RETO-2-CUADERNO/](RETO-2-CUADERNO/README.md) · [RETO-2-CORTO.md](RETO-2-CUADERNO/RETO-2-CORTO.md)
- [Planes](../../planes/README.md) · [RDA2-docs](../README.md)

← Volver a [RDA2-docs/README.md](../README.md)
