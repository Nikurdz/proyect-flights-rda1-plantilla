# Estado de los hallazgos de las auditorías (11-oct-2026)

Verificado en el código actual de la rama `vuelos`, después de configurar ESLint (backend: ESLint 10 + typescript-eslint; frontend: ESLint 9 + typescript-eslint + react-hooks + jsx-a11y estricto, porque `jsx-a11y` aún no admite ESLint 10). Ambos `npm run lint` terminan con 0 errores y 0 avisos.

**Resultado:** backend 252 pruebas en verde; frontend 110 pruebas en verde; los dos compilan.

## Backend — `AUDITORIA-10-6-2026-Backend.md`

| ID | Estado | Cómo quedó |
|----|--------|------------|
| A1 | Corregido | El hold congela los impuestos (`lockedTaxesMinor`, migración `HoldLockedTaxes`); la cotización no depende del precio vivo. |
| A2 | Corregido (documentado) | El mapa de asientos es de cabina; el conflicto lo resuelve la clave única y responde 409. Documentado en Swagger. |
| A3 | Aceptado (RDA1) | El simulador de pasarela guarda estado en memoria; con una pasarela real la referencia es la clave de idempotencia. |
| A4 | Corregido | `compensar()` ya no falla si el mercado desapareció; con prueba. |
| A5 | Aceptado (RDA1) | Rate-limit por proceso; `TRUST_PROXY=1` en el despliegue. Redis cuando haya varias instancias. |
| A6 | Aceptado (RDA1) | Sin outbox; lo cubren el reconciliador (60 s) y el índice único de eventos. |
| M1 | Corregido | Las ofertas de cambio de fecha se reutilizan (dedup) y se purgan. |
| M2 | Corregido | La cotización de cancelación vigente se reutiliza. |
| M3 | Decisión | Elegir asiento es gratis en todas las tarifas en esta fase (documentado en `CLAUDE.md`). |
| M4 | Corregido | `Retry-After` en 409 por contención y en 429. |
| M5 | Aceptado | La coherencia token–marca solo la puede comprobar la pasarela (los tokens son opacos); responde 402. |
| M6 | Corregido | `restore` registra un aviso cuando recorta. |
| M7 | Corregido | El barredor purga las ofertas vencidas. |
| M8 | Corregido ahora | La búsqueda descarta combinaciones con un tramo que sale antes de que aterrice el anterior, y el hold lo rechaza (422). Pruebas unitaria e integración. |
| M9 | Corregido | El documento se normaliza (espacios y guiones) antes de comparar duplicados. |
| B1 | Corregido ahora | El 501 queda como mapeo reservado del filtro, comentado. |
| B2 | Corregido | Redondeo del dinero en un solo punto. |
| B3 | Corregido | La ventana de embarque está en la configuración. |
| B4 | Corregido | `quantity` acotado al tope real. |
| B5 | Se mantiene | El enum de estados de check-in es el del contrato (API-first); el servicio usa un subconjunto. |
| B6 | Corregido | El DTO del webhook delega en la defensa SSRF. |
| B7 | Corregido | `flight.*` lo producen las acciones de administración (cancelar/reprogramar). |
| B8 | Corregido | Claves de los jobs unificadas. |

Errores que ESLint encontró y se corrigieron ahora: promesa sin manejar en `main.ts` (el arranque fallido ahora sale con error), importaciones y variables sin uso, y un ejemplo de Swagger mal escapado (`'^\d{13}$'` se mostraba como `^d{13}$`).

## Frontend — `AUDITORIA-10-6-2026-Frontend.md`

Los 24 hallazgos (C1–C4, A1–A6, M1–M8, B1–B6) están corregidos. Esta vez se cerraron los que quedaban: C1 (combobox de aeropuertos: la lista salía vacía al enfocar), C2 (fondo del `Dialog` no interactivo y opción `dismissible`), A3 (unos 30 textos de bajo contraste), A4 (`Button sm` a 44 px en móvil) y M4 (modal de precio sin una X inerte). Además ESLint destapó un fallo real en `ConditionsForm`: el enlace estaba dentro de la etiqueta del checkbox. Detalle por hallazgo en `planes/2026-10-11-frontend-eslint-a11y.md`.

**Pendiente menor:** algunos textos de 10–11 px quedan cerca de 4.3:1; hay que medirlos con axe en el navegador.

## Auditorías anteriores

`AUDITORIA.md` (28-sep) y las dos del 4-oct describen estados ya superados: sus críticos y altos se corrigieron en los commits `aeab06b`, `816d519` y siguientes, y lo confirmó la auditoría del 6-oct.
