# Plan de implementación: ESLint en backend y frontend, y cierre de pendientes de las auditorías

- **Fecha:** 2026-10-11
- **Agente:** Claude Code Desktop (backend) y Antigravity (frontend)
- **Área:** backend, frontend y documentación
- **Rama:** `vuelos`

## Objetivo
Que `npm run lint` funcione y pase sin errores en backend y frontend (hasta hoy ESLint ni siquiera estaba instalado), y cerrar los hallazgos de las auditorías del 6-oct (`RDA1-docs/AUDITORIA-10-6-2026-Backend.md` y `-Frontend.md`) que sigan abiertos, verificando cada uno en el código.

## Alcance
- Incluye: ESLint 9 (configuración plana) con `typescript-eslint` en el backend (código de Vuelos, `src/common`, `main.ts`, `app.module.ts`, scripts) y en el frontend (más `react-hooks` y `jsx-a11y`); corrección de todos los errores; verificación y corrección de los hallazgos abiertos de las auditorías de backend y frontend; registro del estado de cada hallazgo.
- No incluye: los módulos de otros equipos (`alojamientos`, `autos`, `atracciones`), que quedan fuera del lint; las auditorías de los proyectos `nestjs-productos-*` (son otros repositorios); y los hallazgos que son decisiones de la fase RDA1 (outbox/broker, rate-limit distribuido, pasarela real), que se documentan como aceptados.

## Decisiones
- Reglas: `@eslint/js` recomendado + `typescript-eslint` recomendado, y con información de tipos solo las reglas de promesas (`no-floating-promises`, `no-misused-promises`, `await-thenable`), que son las que encuentran errores reales sin generar cientos de avisos de `any`.
- `npm run lint` verifica sin modificar; `npm run lint:fix` corrige lo automático.

## Verificación
`npm run lint` (backend y frontend) sin errores; `npm run build`; `npm test` con `TEST_DATABASE_URL`; build y tests del frontend; tabla de estado de cada hallazgo de las auditorías.
