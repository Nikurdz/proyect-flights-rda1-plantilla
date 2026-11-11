# Plan de implementación: Observabilidad «En vivo» realmente en vivo

- **Fecha:** 2026-10-07
- **Agente:** Antigravity
- **Área:** frontend
- **Rama:** `vuelos`

## Objetivo
Que la sección «En vivo» de `/admin/observabilidad` se actualice sola y se note: hoy el administrador debe recargar. Causas: refresco de 15 s que react-query pausa sin foco, `staleTime` global de 2 min y ningún indicador de actividad.

## Alcance
- Incluye: `useAdminRuntime` con intervalo de 3 s y parámetro de pausa; `useAdminObservabilidad` con refresco al volver a la pestaña; indicador de estado (punto parpadeante, hora de actualización, «Sin conexión · reintentando»), botón Pausar/Reanudar, resaltado breve de valores que cambian; un test con timers falsos.
- No incluye: cambios de backend, contrato, WebSockets/SSE.

## Contexto y referencias
`GET /admin/observabilidad/runtime` (contadores del proceso) y `/resumen` (BD). Sin cambios de contrato.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `frontend/src/api/endpoints/admin.ts` | `useAdminRuntime(ownerId, {paused})`: `refetchInterval` 3 s (false si pausado), `staleTime: 0`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: 'always'`; constante exportada `RUNTIME_REFRESH_MS`. Resumen: 30 s + `refetchOnWindowFocus: 'always'`. |
| `frontend/src/features/admin/AdminObservabilityPage.tsx` | Cabecera de «En vivo» con indicador, hora y botón Pausar/Reanudar; celdas con resaltado al cambiar. |
| `frontend/tailwind.config.js` | Keyframe `flashGold` (600 ms). |
| `frontend/tests/unit/admin-runtime.test.tsx` | Test del intervalo y de la pausa con timers falsos. |

## Impacto en la API / contrato
Ninguno. Carga: una petición ligera cada 3 s solo con la pestaña visible y sin pausa.

## Pasos
1. Ajustar hooks.
2. Añadir indicador, botón y resaltado (punto con `motion-safe:`; hora en región `role="status"` no ruidosa).
3. Test, `npm run build`, `npm test`.

## Riesgos y decisiones abiertas
- Carga del servidor: mitigada con pausa y sin refresco en segundo plano.
- El resaltado no usa solo color: no sustituye información, es refuerzo visual; los números cambian en el texto.

## Verificación
`cd frontend && npm run build && npm test` sin errores; prueba manual contra el backend en ejecución.
