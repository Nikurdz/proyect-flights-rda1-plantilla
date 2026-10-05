# Prompt para Antigravity — Frontend (UX/UI) de Vuelos

> Copiar todo lo que está debajo de la línea y pegarlo en Antigravity.

---

## ROL
Actúa como diseñador UX/UI y desarrollador frontend senior. Construye el **frontend web de una plataforma de venta de vuelos** (estilo aerolínea LATAM: Ecuador y Colombia). Alcance **exclusivo: Vuelos**. No hagas alojamientos, autos, atracciones ni ninguna otra vertical.

## CONTEXTO
Ya existe el backend (NestJS, REST, JSON) ya desplegado en Render, con Swagger. El frontend consume esa API; **no modifiques el backend**.
- URL base de la API: variable de entorno `VITE_API_URL` (ej. `https://<app>.onrender.com/api/v1`; local: `http://localhost:3000/api/v1`).
- Contrato vivo: `{VITE_API_URL sin /api/v1}/api/docs` (Swagger UI) y `/api/docs-json` (OpenAPI). **Genera un cliente tipado desde ese JSON** (`openapi-typescript`) y úsalo como fuente de verdad de nombres de campos; no inventes campos.
- El backend en Render gratis se duerme: la primera llamada puede tardar ~50 s. Muestra un estado "Despertando el servidor…" con reintento automático.
- Los pagos son **simulados**: nunca pidas ni envíes números de tarjeta reales (ver "Pago").

## STACK Y RESTRICCIONES (todo gratuito)
- React + Vite + TypeScript, React Router, TanStack Query, Tailwind CSS (componentes accesibles, p. ej. shadcn/ui o Radix). Formularios con React Hook Form + Zod.
- Desplegable en Vercel / Netlify / Cloudflare Pages (SPA estática, sin servidor propio).
- Mobile-first, responsive, accesible (WCAG 2.1 AA: foco visible, contraste, teclado, labels, `aria-live` en errores). Modo claro (oscuro opcional).
- Idioma de la interfaz: **español** (estructura lista para i18n; inglés después).
- Sin secretos en el repo. Solo `VITE_API_URL`.

## FLUJO DE PANTALLAS (R1: "Compra de vuelo")
1. **Inicio / buscador**: origen y destino con autocompletado (`GET /localidades?q=`), ida / ida y vuelta, fechas, pasajeros (adultos, niños, infantes), selector de **mercado** (Ecuador `ec` USD / Colombia `co` COP). Cabina solo ECONOMY (única disponible). Los parámetros son opcionales: sin origen/destino/fecha el backend usa valores por defecto; permite "explorar" sin llenar todo. Deep-link por URL con los mismos parámetros (`origin, destination, outbound, inbound, adt, chd, inf, trip, sort, mercado`).
2. **Resultados** (`GET /disponibilidad`): tarjetas de itinerario (hora salida/llegada en la zona horaria del aeropuerto, duración, número de vuelo, precio "desde"), orden (`RECOMENDADO, MAS_BARATOS, MAS_RAPIDOS, SALIDA_TEMPRANO, SALIDA_TARDE, LLEGADA_TEMPRANO, LLEGADA_TARDE`), vista por trayectos (ida / vuelta), selector de día cercano, estados vacío / cargando (skeleton) / error. Solo vuelos directos.
3. **Tarifas** (`GET /itinerarios/:id/tarifas`): comparador de familias **BASIC / LIGHT / FULL** (equipaje de mano y de bodega, cambios, reembolso, selección de asiento, acumulación) con precio total del grupo y desglose por tipo de pasajero + impuestos.
4. **Checkout** en pasos con resumen lateral fijo y **cuenta regresiva** hasta `venceEn` (la oferta retiene cupo ~15 min):
   - Crear oferta: `POST /ofertas` (`mercado`, `selecciones[{itinerarioId, familia}]`, `pasajeros`).
   - Pasajeros y contacto: `PUT /ofertas/:id/pasajeros` (nombres, apellidos, fecha de nacimiento, género M/F/X, nacionalidad ISO-2, documento PASSPORT/NATIONAL_ID, vencimiento; infantes asociados a un adulto; contacto con correo y teléfono E.164).
   - Facturación: `PUT /ofertas/:id/facturacion`.
   - Condiciones: `POST /ofertas/:id/condiciones` (versiones de términos y de condiciones de transporte aceptadas).
   - Revalidación antes de pagar: `POST /ofertas/:id/revalidacion`. Si cambió el precio → modal comparando anterior/nuevo y botón "Aceptar nuevo precio" (`POST /ofertas/:id/aceptacion-precio` con `totalAceptado`).
   - Medios de pago: `GET /ofertas/:id/medios-pago` (marcas y cuotas según mercado).
   - Pago: `POST /ofertas/:id/compra`.
5. **Confirmación**: número de orden, **PNR**, e-tickets por pasajero, itinerario, total pagado, aviso de correo enviado, descarga/impresión (CSS print).
6. **Recuperar orden** (público, sin cuenta): `GET /ordenes?numero=…` o `?pnr=…` **más `apellido`** (obligatorio). Resultado sin datos de contacto. Mensaje genérico si no existe (404).
7. **Cuenta**: registro (`POST /clientes`), verificación de correo (`POST /auth/verificar-correo` desde el link), login (`POST /auth/login`), perfil y preferencias (`GET /clientes/me`, `PUT /clientes/me/preferencias`), **mis órdenes** (`GET /clientes/me/ordenes` con paginación por cursor `limit/cursor`) y detalle (`GET /ordenes/:numero`).
8. **Invitado**: comprar sin cuenta (`POST /auth/invitado` devuelve token); ofrecer crear cuenta tras la compra.

Fuera de alcance: back-office/admin, postventa (cambios, equipaje extra, cancelación), check-in, webhooks, mapa de asientos (el backend responde 501 o no se usa en R1).

## AUTENTICACIÓN
- `Authorization: Bearer <accessToken>` en todo excepto `/disponibilidad`, `/localidades`, `/mercados/:codigo`, `/auth/*`, `POST /clientes` y `GET /ordenes`.
- Guarda el token en memoria (+ `sessionStorage`); expira en ~1 h → ante 401 renueva (invitado) o redirige a login conservando el carrito.
- Si no hay token al armar una oferta, crea una sesión de invitado automáticamente.

## REGLAS DE API QUE LA UI DEBE RESPETAR
- **`Idempotency-Key`** (UUID v4) obligatorio en `POST /ofertas` y `POST /ofertas/:id/compra`. Genera una por intento de usuario y **reutilízala en reintentos** (red caída, doble clic). Deshabilita el botón de pagar mientras hay una petición en curso.
- **Dinero**: llega como string (`{ moneda, monto }`); formatea con `Intl.NumberFormat` según la moneda. **COP/CLP no tienen decimales**. Nunca hagas aritmética con floats.
- **Errores** en `application/problem+json` con campo `code` y `invalidParams[{name, reason}]`: mapea cada `code` a un mensaje en español, y pinta `invalidParams` junto al campo. Códigos: `VALIDATION_FAILED` (400/422), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND`/`ORDER_NOT_FOUND` (404), `EMAIL_ALREADY_REGISTERED` (409), `INVALID_CREDENTIALS` (401), `ACCOUNT_LOCKED` (423), `MARKET_NOT_AVAILABLE`, `OFFER_EXPIRED` (410: volver a buscar), `OFFER_INCOMPLETE` (faltan pasajeros, facturación o condiciones), `OFFER_NOT_PAYABLE`, `PRICE_CHANGED` (409 → flujo de nuevo precio), `CONDITIONS_VERSION_MISMATCH` (recargar condiciones), `SEAT_TAKEN` y `OFFER_NO_LONGER_AVAILABLE` (sin cupo), `PAYMENT_DECLINED` y `PAYMENT_REJECTED_BY_FRAUD` (402: la oferta sigue vigente, permitir otro medio), `PAYMENT_METHOD_NOT_ALLOWED` (422), `ISSUANCE_FAILED_COMPENSATED` (el pago se liberó, reintentar), `RATE_LIMIT_EXCEEDED` (429, mostrar espera), `SERVICE_UNAVAILABLE` (503). Cualquier `code` desconocido → mensaje genérico. Muestra siempre el `X-Correlation-Id` en "detalles técnicos" para soporte.
- Una respuesta de compra repetida con la misma key devuelve el resultado original (no cobra dos veces).
- Fechas en UTC (ISO 8601): muéstralas en la zona horaria del aeropuerto (`zonaHoraria` de cada localidad).

## PAGO (SIMULADO — importante)
No hay pasarela real. Implementa un formulario "Tarjeta" con UX realista **pero** la petición solo envía un token de prueba: `medio: { tipo: 'TARJETA', token, marca }`. En esta fase ofrece un **selector "Tarjeta de prueba"** (visible solo si `VITE_SHOW_TEST_CARDS=true`) con estos escenarios:
- Aprobada: `tok_visa_ok` (marca VISA), `tok_mastercard_ok`, `tok_amex_ok`, `tok_diners_ok` (la marca del token debe coincidir con `marca`).
- Rechazos: `tok_declined`, `tok_insufficient`, `tok_expired`, `tok_3ds`, `tok_fraud`, `tok_review`.
- Fallo de captura (la venta igual se emite): `tok_visa_capture_fail`.
Nunca captures, guardes ni registres en consola números reales de tarjeta. Cuotas según `medios-pago`.

## DISEÑO (UX/UI)
- Estilo aerolínea moderno, limpio, mucho aire; identidad propia (no copies marcas registradas). Paleta con un color primario, neutros y colores semánticos (éxito, alerta, error). Tipografía legible (Inter o similar). Define **design tokens** (colores, espaciado, radios, sombras) en Tailwind.
- Componentes reutilizables: SearchBar, FlightCard, FareFamilyCard, PassengerForm, Stepper, PriceSummary, Countdown, ProblemAlert, MoneyText, EmptyState, Skeleton, Toast.
- Resumen de precio siempre visible en checkout (desglose por tipo de pasajero + impuestos + total, en la moneda del mercado).
- Estados de cada pantalla: cargando, vacío, error, sin conexión, sesión expirada, oferta vencida.
- Microcopys claros en español (errores accionables, no técnicos). Confirmación antes de salir del checkout.
- Accesibilidad: navegación por teclado completa, anuncios `aria-live`, no depender solo del color.

## ENTREGABLES
1. Proyecto Vite + TS funcional con la estructura: `src/{api,components,features/{search,results,checkout,orders,account},hooks,lib,routes,styles}`.
2. Cliente API tipado generado desde OpenAPI + capa de manejo de errores `problem+json`.
3. Todas las pantallas del flujo anterior conectadas a la API real (no datos mock salvo tests).
4. Tests: unitarios de utilidades (dinero, fechas, mapeo de errores) y un e2e (Playwright) del camino feliz: buscar → elegir tarifa → pasajeros → pagar con `tok_visa_ok` → confirmación; y del rechazo `tok_declined` → reintento.
5. `README` con variables (`VITE_API_URL`, `VITE_SHOW_TEST_CARDS`), comandos y pasos de despliegue gratuito en Vercel/Netlify.
6. Entrega por iteraciones: (a) design system + buscador + resultados, (b) tarifas + checkout, (c) pago + confirmación + recuperar orden, (d) cuenta y mis órdenes, (e) pulido, accesibilidad y e2e. Al terminar cada una, resume qué quedó y qué falta.

## CRITERIOS DE ACEPTACIÓN
- El camino feliz completo funciona contra la API desplegada, en móvil y escritorio.
- Un reintento de pago con la misma `Idempotency-Key` no genera una segunda orden.
- COP se muestra sin decimales y USD con dos.
- Cada error de la API se ve como mensaje comprensible junto al campo o en una alerta, con su código técnico accesible.
- Lighthouse Accesibilidad ≥ 90 en Inicio, Resultados y Checkout.
