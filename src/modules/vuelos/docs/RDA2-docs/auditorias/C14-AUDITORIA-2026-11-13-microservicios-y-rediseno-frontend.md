# Auditoría Microservicios (demo local) y rediseño del frontend — 2026-11-13
**Plan:** 2026-11-13-contenedores-por-microservicio y 2026-11-13-rediseno-frontend-nielsen · **Commits:** 7e52601, 35b0b5c, 3c9d4b4 · **Archivos clave:** `src/modules/vuelos/esb/rabbitmq.transport.ts`, `src/modules/vuelos/common/domain-event-bus.ts`, `frontend/scripts/contrast.mjs`, `frontend/src/features/admin/LedStatus.tsx`

## 1. Resumen ejecutivo
Cada servicio corre en su contenedor con una cola por satélite, y el monolito es el valor por defecto (`SERVICE_ROLE` vacío). Los satélites pierden eventos si el broker cae o aún no tiene cola. El frontend conserva estilos antiguos. Críticos: 0 · Altos: 0 · Medios: 3 · Bajos: 2

## 2. Hallazgos críticos, altos, medios y bajos
| ID | Severidad | Hallazgo |
|---|---|---|
| M-1 | Medio | Con el broker caído el bus entrega en proceso y los satélites (`SERVICE_ROLE=api`) no reciben el evento: se pierde para auditoría, correo y webhooks. |
| M-2 | Medio | La cola de cada satélite se declara solo al conectar: un evento publicado antes no tiene cola enlazada y se descarta. |
| M-3 | Medio | `contrast.mjs` no cubre `on-chrome` sobre `chrome` y no está en `npm test`: el contraste AA no se vigila. |
| B-1 | Bajo | Siguen clases `slate-*`/`bg-white` en 5 archivos de `features/admin/` (puente de estilos). |
| B-2 | Bajo | `AdminNodesHealthPage` enlaza a `/admin/proveedores`, que ahora solo redirige al dashboard. |

## 3. Evidencia concreta (archivo y elemento afectado)
| ID | Archivo | Elemento afectado |
|---|---|---|
| M-1 | src/modules/vuelos/common/domain-event-bus.ts | `publish` (`catch` y luego `despachar` en proceso) |
| M-1 | src/modules/vuelos/esb/rabbitmq.transport.ts | `publicar` (`throw new Error('RabbitMQ is not connected')`) |
| M-2 | src/modules/vuelos/esb/rabbitmq.transport.ts | `conectarYConsumir` (`assertQueue`/`bindQueue` de `colaServicio`) |
| M-3 | frontend/scripts/contrast.mjs | arreglo `PAIRS`; no aparece en `frontend/package.json` (`"test": "vitest run"`) |
| B-1 | frontend/src/features/admin/LedStatus.tsx | variable `tone` (`bg-slate-100 text-slate-700`) |
| B-2 | frontend/src/features/admin/AdminNodesHealthPage.tsx | `<Link to="/admin/proveedores">` |

## 4. Recomendación de corrección
| ID | Recomendación |
|---|---|
| M-1 | Reintentar la publicación o guardar el evento pendiente en vez de entregarlo solo en el núcleo. |
| M-2 | Declarar y enlazar las colas de los satélites también desde el núcleo al arrancar. |
| M-3 | Añadir los pares faltantes y ejecutar `contrast.mjs` desde `npm test`. |
| B-1 | Migrar esos 5 archivos a los tokens nuevos y retirar el puente de `tailwind.config.js`. |
| B-2 | Quitar el enlace o apuntarlo a una ruta existente. |

## 5. Pruebas que deberían repetirse después de corregir
- `npx jest src/modules/vuelos/common/service-role.spec.ts src/modules/vuelos/esb/rabbitmq.transport.spec.ts`
- `npm run micro:build && npm run micro:up && npm run micro:smoke`
- `node frontend/scripts/contrast.mjs`
- `cd frontend && npm run lint && npm test`

Verificado en código el 2026-11-15 sobre el commit 3c9d4b4.
