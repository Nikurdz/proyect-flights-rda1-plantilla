# Entrega para Antigravity: trazabilidad unificada y flujo por nodos

- **Fecha:** 2026-11-09
- **De:** Claude Code Desktop (backend) **a:** Antigravity (frontend)
- **Rama:** `vuelos`

El administrador necesita ver **todo lo que se hace en el sistema** (quién, qué, cuándo, con qué petición) y **confirmar visualmente la comunicación entre componentes** (cliente web, Booking, API, saga de órdenes, inventario, pagos, facturación, notificaciones, webhooks…) con un grafo de nodos que se abre con un botón. **Proveedores y salud de nodos NO forman parte de la trazabilidad** (ya vienen filtrados del backend; las pestañas Proveedores / Salud de nodos se dejan como están). El backend está listo y probado (`testing/trazabilidad.integration.spec.ts`).

## API (todas ADMIN, Bearer, `application/problem+json` en error, horas en UTC `…Z`; mostrar siempre hora de Ecuador con `formatAdminDateTime`)
| Acción | Llamada |
|---|---|
| Línea de tiempo | `GET /api/v1/admin/trazabilidad?correlationId=&numero=&entidad=&id=&actor=&tipo=&fuente=evento\|saga\|admin&desde=&hasta=&antes=&limite=50` → `{ items[], siguiente }` |
| Flujo | `GET /api/v1/admin/trazabilidad/flujo?correlationId=` **o** `?numero=` (orden ORD-… o PNR) → `{ nodos[{id,etiqueta,tipo}], aristas[{orden,desde,hasta,etiqueta,fuente,estado,ms,en,correlationId}], correlaciones[], truncado }` |
| Mapa general | `GET /api/v1/admin/trazabilidad/mapa?desde=&hasta=` → `{ nodos[], enlaces[{desde,hasta,total,errores}] }` |
| CSV | `GET /api/v1/admin/trazabilidad/export.csv` con los mismos filtros de la lista (descarga: `apiBlob` + `saveBlob`, como `useExportarReservasCsv`) |

Cada `item`: `fuente` (`evento` \| `saga` \| `admin`), `id`, `en` (ISO), `correlationId`, `tipo` (`booking.cancelled`, `COMPRA`, `usuario.CREAR`, `acceso.login_fallido`, `llamada.webhook`…), `estado` (`OK` \| `ERROR` \| `COMPENSADA` \| `EN_CURSO`), `actorId`, `actorTipo` (`CUSTOMER` \| `GUEST` \| `PARTNER` \| `ADMIN` \| `SYSTEM` \| `ANONIMO`), `entidad`, `referencia`, `numero`, `origen`, `destino`, `resumen`, y para las sagas `pasos[{secuencia,nombre,estado,detalle,duracionMs,en}]`.

- **Paginación por cursor:** «Cargar más» pide `antes=<siguiente>` de la página anterior; si `siguiente` es `null`, no hay más.
- `desde` / `hasta` son **días de Ecuador** (`YYYY-MM-DD`, inclusive; por defecto vacío = todo).
- Los ids de nodo son estables: `web`, `admin`, `booking`, `api`, `identidad`, `catalogo`, `inventario`, `ordenes`, `pagos`, `facturacion`, `notificaciones`, `webhooks`, `auditoria`. El backend decide qué nodos y flechas hay; **el frontend no debe tener una lista fija de conexiones** (así el diagrama nunca queda desactualizado). Si llega un id de nodo desconocido, se dibuja igual con su `etiqueta`.
- Las filas no llevan datos personales (ids y resúmenes); no intentes mostrar correos ni nombres.

## Pantalla (reescribir `features/admin/AdminAuditPage.tsx`, ruta `/admin/auditoria`)
1. **Filtros:** n.º de orden o PNR (`numero`), correlationId (también por `?correlationId=` en la URL, como hoy), actor, tipo, fuente (select), desde, hasta; botón «Exportar CSV».
2. **Tabla unificada** (de lo más reciente a lo más antiguo): hora de Ecuador, fuente (insignia), tipo, estado (color: OK / COMPENSADA / ERROR / EN_CURSO), actor (`actorTipo` + `actorId` abreviado), referencia/n.º, resumen y enlace por `correlationId`. Las filas de saga se expanden con sus pasos (nombre, estado, ms). Carga, vacío y error como el resto del panel. «Cargar más» con el cursor.
3. **Botón «Ver flujo»** en cada fila (usa su `correlationId`) y en la cabecera cuando hay `numero` en el filtro. Abre un panel (modal o lateral) con el grafo.
4. **Botón «Mapa general»** en la cabecera: mismo componente de grafo con `enlaces` (grosor/etiqueta = `total`, rojo si `errores > 0`).
5. **Grafo de nodos** (SVG propio, **sin librerías nuevas**): componente `features/admin/TraceFlowGraph.tsx`.
   - Columnas por `tipo` de nodo: `cliente` a la izquierda (web, admin), `servicio` en el centro, `externo` a la derecha (booking). Dentro de una columna, orden estable por `COMPONENTES` del backend (usa el orden de `nodos`).
   - Cada arista es una flecha con su número `orden` (1, 2, 3…), etiqueta (`etiqueta`) y color por `estado`: `OK` neutro/verde, `COMPENSADA` ámbar, `ERROR` rojo. Aristas entre el mismo par se separan ligeramente (curvas) para no solaparse; una arista a sí mismo (`ordenes → ordenes`) se dibuja como un lazo.
   - Clic o foco en una flecha: detalle (etiqueta, fuente, estado, `ms` si existe, hora de Ecuador, correlationId). Accesible con teclado (`tabIndex`, `aria-label`).
   - Lista textual de los pasos al lado (misma información, para lectores de pantalla y móvil); si `truncado`, avisa de que el flujo se cortó en 500 pasos.
6. **Siempre actualizado:** mientras el panel del grafo esté abierto, `refetchInterval` de 10 s (pausado con la pestaña oculta: `refetchIntervalInBackground: false`); una flecha nueva se resalta unos segundos. Además, la suscripción GraphQL (`graphql-ws`, `gateway/`) ya existe: **si** el cliente de suscripciones está disponible en `api/graphql`, invalida la consulta al recibir un evento; si no, el sondeo basta.
7. **Texto fijo** bajo el título: «Trazabilidad de Vuelos: eventos, sagas y cambios administrativos de todo el sistema. Los proveedores no se incluyen.»

## Qué quitar / arreglar
- Quitar de la pantalla las dos secciones actuales (eventos y sagas por separado) y sus hooks GraphQL de auditoría si ya nadie los usa (`api/endpoints/auditoria.ts`, `lib/auditoria.ts`): sustituir por los endpoints REST de arriba (hooks `useTrazabilidad`, `useFlujoTraza`, `useMapaTraza`, `useExportarTrazaCsv`; tipos a mano en `api/endpoints/`).
- Actualizar los fixtures de `tests/unit/admin-audit-page.test.tsx` y `auditoria.test.ts` (usaban nombres inexistentes `COMPRA_VUELO`, `order.issued`): ahora son `COMPRA`, `OrdenEmitida`, `booking.cancelled`.
- No tocar `AdminProvidersPage`, `AdminNodesHealthPage` ni el dashboard.

## Convenciones
Hora de Ecuador en todo (`SYSTEM_TIME_ZONE`, `formatAdminDateTime`), tipos a mano, `MoneyText` no aplica, sin librerías nuevas, estilos del panel admin existentes, accesibilidad (roles, nombres, foco, contraste en el grafo; colores de estado también con icono o texto).

## Pruebas (vitest + Testing Library, patrón de `admin-reservations-page.test.tsx`)
Filtros → query (blancos no se envían), tabla con actor/estado, expandir saga con pasos, cursor «Cargar más», botón «Ver flujo» abre el grafo con los nodos y flechas ordenadas, color y texto de estado, flecha de error, lazo a sí mismo, `truncado`, «Mapa general», exportación CSV, errores (403/problem+json), y que el sondeo se pide mientras el panel está abierto. `npm run lint`, `npx tsc --noEmit`, `npm run build` y `npm test` en `frontend/` en 0 errores.
