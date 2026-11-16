# Auditoría Envío de stock a Booking por HTTP — 2026-11-03
**Plan:** 2026-11-03-stock-http · **Commits:** 911c2b0, 9f1f698 · **Archivos clave:** v2/stock-push.service.ts, common/vuelos-config.ts, common/safe-http.ts, testing/stock-http.integration.spec.ts

## 1. Resumen ejecutivo
El push HTTP envía el stock absoluto por vuelo con https obligatorio, concurrencia acotada y espera de 1 h para vuelos rechazados. El riesgo es de volumen: reenvíos completos tras fallos o reinicios, y sin backoff ante 429. Críticos: 0 · Altos: 0 · Medios: 3 · Bajos: 1

## 2. Hallazgos críticos, altos, medios y bajos
| ID | Severidad | Hallazgo |
|---|---|---|
| M-1 | Medio | Si una ronda completa falla, `lastFull` no se actualiza: cada sync (30 s) repite una ronda completa. |
| M-2 | Medio | Con `lastPushed` vacío tras cada arranque o despertar de Azure se reenvían todos los vuelos del horizonte. |
| M-3 | Medio | Un 429 de Booking se trata como error de red, sin espera: se reintenta en el siguiente sync. |
| B-1 | Bajo | En gRPC el envío absoluto es en serie, sin concurrencia acotada. |

## 3. Evidencia concreta (archivo y elemento afectado)
| ID | Archivo | Elemento afectado |
|---|---|---|
| M-1 | src/modules/vuelos/v2/stock-push.service.ts | `sync()`: `if (full) this.lastFull = now` tras `httpPush`; `SAFETY_NET_MS = 30_000` |
| M-2 | src/modules/vuelos/v2/stock-push.service.ts | `sync()`: `full = this.lastPushed.size === 0 \|\| …` |
| M-3 | src/modules/vuelos/v2/stock-push.service.ts | `httpPushOne()`: `answer.status === 429` devuelve `kind: 'error'` |
| B-1 | src/modules/vuelos/v2/stock-push.service.ts | `sync()`: bucle `for (const s of absolute) await this.pushUpdate(...)` |

## 4. Recomendación de corrección
| ID | Recomendación |
|---|---|
| M-1 | Aplicar backoff exponencial entre rondas fallidas y no repetir los vuelos ya enviados. |
| M-2 | Persistir el último valor enviado o limitar la ronda inicial por lotes. |
| M-3 | Leer `Retry-After` y pausar la ronda al recibir 429. |
| B-1 | Reutilizar el pool de workers de HTTP también para gRPC. |

## 5. Pruebas que deberían repetirse después de corregir
- `npx jest src/modules/vuelos/testing/stock-http.integration.spec.ts` (requiere `TEST_DATABASE_URL`)
- `npx jest src/modules/vuelos/testing/stock-grpc.integration.spec.ts` (requiere `TEST_DATABASE_URL`)
- `npx jest src/modules/vuelos/services/search.service.spec.ts`
- `npm run lint`

Verificado en código el 2026-11-15 sobre el commit 3c9d4b4.
