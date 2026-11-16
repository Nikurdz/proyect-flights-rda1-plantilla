# Auditoría BFF por cliente y gateway local Kong — 2026-11-08
**Plan:** 2026-11-08-bff-clientes-y-gateway · **Commits:** 027b470, 30ce024 · **Archivos clave:** src/modules/vuelos/ecommerce/bff/bff-ordenes.service.ts, src/modules/vuelos/ecommerce/bff/bff.controller.ts, deploy/gateway/kong.yml, docker-compose.yml

## 1. Resumen ejecutivo
Las vistas BFF son de solo lectura y respetan propiedad (orden ajena = 404, invitado = 403, expediente solo ADMIN). El secreto JWT de Kong es solo un marcador. Los defectos son de endurecimiento del gateway, que es solo local. Críticos: 0 · Altos: 0 · Medios: 1 · Bajos: 2

## 2. Hallazgos críticos, altos, medios y bajos
| ID | Severidad | Hallazgo |
|---|---|---|
| M-1 | Medio | El límite de 300 peticiones/min de Kong es local por nodo y tolera fallos: con varias instancias no es global. |
| B-1 | Bajo | La API escucha en 0.0.0.0:3000, así que se puede saltar Kong y sus reglas de borde. |
| B-2 | Bajo | Kong solo valida firma y `exp`; el rol ADMIN depende únicamente de la API. |

## 3. Evidencia concreta (archivo y elemento afectado)
| ID | Archivo | Elemento afectado |
|---|---|---|
| M-1 | deploy/gateway/kong.yml | plugin `rate-limiting`: `policy: local`, `fault_tolerant: true` |
| B-1 | src/main.ts | `app.listen(process.env.PORT \|\| 3000, '0.0.0.0')` (línea 72) |
| B-2 | deploy/gateway/kong.yml | ruta `api-protegida`, plugin `jwt` con `claims_to_verify: [exp]` |

## 4. Recomendación de corrección
| ID | Recomendación |
|---|---|
| M-1 | Usar `policy: redis` o `cluster` si el gateway se despliega con más de una instancia. |
| B-1 | En la demo con Kong, publicar solo el puerto 8000 y dejar la API en red interna. |
| B-2 | Añadir el plugin `acl` en `/api/v1/admin` como defensa en profundidad. |

## 5. Pruebas que deberían repetirse después de corregir
- `npx jest src/modules/vuelos/ecommerce/bff/mapeos.spec.ts src/modules/vuelos/ecommerce/bff/acciones.spec.ts src/modules/vuelos/ecommerce/common/enmascarar.spec.ts`
- `npx jest src/modules/vuelos/testing/bff.integration.spec.ts` (requiere TEST_DATABASE_URL)
- `docker compose --profile gateway up -d kong` y `npm run gateway:smoke`

Verificado en código el 2026-11-15 sobre el commit 3c9d4b4.
