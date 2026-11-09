# Plan de implementación: aeropuertos de Ecuador (Loja) y alta de aeropuertos desde el back office

- **Fecha:** 2026-11-08
- **Agente:** Claude Code Desktop (backend) y Antigravity (pantalla)
- **Área:** backend / catálogo / frontend admin
- **Rama:** `vuelos`

## Objetivo
El catálogo solo tenía UIO, GYE, CUE y GPS de Ecuador: faltaban Loja (`LOH`) y el resto. Se cargan todos los aeropuertos de Ecuador con código IATA y un administrador puede crear nuevos códigos tras una confirmación.

## Alcance
- Incluye: seed de los aeropuertos, vuelos UIO↔LOH y GYE↔LOH, catálogo público completo con `q` vacío, API `GET/POST /admin/aeropuertos` con `confirmar: true`, pantalla «Aeropuertos» y zonas horarias en el frontend.
- No incluye: editar o borrar aeropuertos (los vuelos los referencian con FK `RESTRICT`), horarios reales de aerolíneas, husos con horario de verano.

## Decisiones
- Lista tomada de Wikipedia «List of airports in Ecuador» (solo los que tienen IATA): UIO, GYE, CUE, GPS, **LOH**, MEC, ESM, LTX, SNC, SCY, ETR, TUA, ATF, BHA, OCC, MRR, XMS, MCH*, LGQ, PVO*, PYO, WSE, PTZ, SUQ, TSC, TPC, TNW (Tena), TPN (Tiputini), JIP. *Machala y Portoviejo figuran como cerrados y se marcan «(cerrado)» en el nombre. Ibarra, Riobamba, Isabela y Gualaquiza **no** tienen código IATA en esa fuente y no se cargan. JIP figura con coordenadas sin verificar. Es una sola fuente: conviene contrastarla con la DGAC antes de una demostración formal.
- Zona horaria: `America/Guayaquil` (UTC-5); Galápagos (GPS, SCY) `Pacific/Galapagos` (UTC-6).
- El seed añade filas con `INSERT … ON CONFLICT DO NOTHING`: se despliega solo, sin migración, y nunca pisa lo que un administrador haya creado o editado.
- Vuelos nuevos en el seed: UIO↔LOH (LA2470…, 60 min, 75 USD, 96 asientos) y GYE↔LOH (LA2480…, 50 min, 68 USD, 96 asientos).
- Alta de administrador: `POST /admin/aeropuertos` exige `confirmar: true` (422 si falta); IATA de 3 letras, país de 2 letras, zona IANA real; 409 si ya existe; queda en `auditoria_administrativa` (`aeropuerto`/`CREAR`). La pantalla pide la confirmación con un resumen antes de enviar.
- `GET /localidades` sin texto devuelve todo el catálogo (hasta 200) en lugar de 10, para que el desplegable de «Crear vuelo» ofrezca todos.

## Cambios
| Archivo | Cambio |
|---|---|
| `ecommerce/seed/ecommerce.seed.ts` | 25 aeropuertos de Ecuador |
| `seed/flights.seed.ts` | `UTC_OFFSET` de LOH y las rutas a Loja |
| `ecommerce/catalogo/catalogo.service.ts` | Catálogo completo con `q` vacío |
| `ecommerce/admin/admin-aeropuertos.dto.ts`, `aeropuertos-admin.{service,controller}.ts`, `admin.module.ts` | API de administración |
| `testing/admin-aeropuertos.integration.spec.ts` | Pruebas |
| `frontend/…` | Pantalla, hooks, zonas horarias (ver `2026-11-08-aeropuertos-frontend.md`) |
| `contracts/vuelos-ecommerce-openapi.yaml` | Regenerado |

## Impacto en la API / contrato
Rutas nuevas bajo `/api/v1/admin/aeropuertos` (OpenAPI regenerado). `GET /api/v1/localidades` sin `q` devuelve más filas. Los contratos v1 y v2 no cambian.

## Riesgos
- Los vuelos nuevos (LA2470…, LA2480…) entran en el envío de stock a Booking; si Booking rechaza un `item_id` desconocido, queda registrado una vez por ronda.
- Un código creado por un administrador no se puede deshacer desde la web.

## Verificación
`npm run lint`, `npm run build`, `npm test`, `contract:export`, y en `frontend/` lint, `tsc`, build y tests. Prueba manual: `GET /localidades?q=loj`, búsqueda UIO→LOH y alta de un código con y sin `confirmar`.
