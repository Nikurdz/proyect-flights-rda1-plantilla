# Plan de implementación: Frontend Web UX/UI — Sistema de Venta de Vuelos (LATAM)

- **Fecha:** 2026-10-05
- **Agente:** Antigravity (Senior UX/UI & Frontend Developer)
- **Área:** frontend
- **Rama:** `vuelos`

## Objetivo
Diseñar e implementar el frontend web completo para la plataforma de venta de vuelos (estilo aerolínea LATAM para Ecuador y Colombia), consumiendo la API REST de NestJS desplegada en Render sin alterar el backend, garantizando accesibilidad WCAG 2.1 AA, resiliencia ante arranque en frío de Render (~50 s), manejo estricto de idempotencia, dinero formateado según mercado y simulación realista de pagos.

## Alcance
- **Incluye:**
  - Estructura y configuración del proyecto en `frontend/` (React + Vite + TypeScript + Tailwind CSS + React Router + TanStack Query + React Hook Form + Zod + Lucide React).
  - Sistema de diseño de aerolínea con tokens (colores, espaciado, tipografía, sombras, bordes) y componentes accesibles (WCAG 2.1 AA, `aria-live`, navegación por teclado).
  - Cliente API fuertemente tipado generado desde el contrato OpenAPI (`/api/docs-json`), con interceptor RFC 7807 (`application/problem+json`), inyección de `Idempotency-Key` UUID v4 y cabecera `Authorization: Bearer <token>`.
  - Mecanismo de detección de backend dormido ("Despertando el servidor…") con reintento automático y barra de espera.
  - Pantalla 1: Inicio / Buscador interactivo con autocompletado (`GET /localidades?q=`), selector de mercado (`ec` USD / `co` COP), pasajeros, fechas, cabina ECONOMY y sincronización bidireccional con URL (deep-linking).
  - Pantalla 2: Resultados (`GET /disponibilidad`), tarjetas de vuelo con zona horaria del aeropuerto, selector de días alternativos, ordenamientos y skeletons.
  - Pantalla 3: Comparador de familias tarifarias (`GET /itinerarios/:id/tarifas`) para BASIC, LIGHT y FULL con desglose de impuestos y vigencia.
  - Pantalla 4: Checkout guiado por pasos (stepper) con resumen lateral fijo, temporizador de retención de inventario (`venceEn` ~15 min):
    - Sesión automática de invitado (`POST /auth/invitado`) o sesión iniciada.
    - Reserva y retención de inventario (`POST /ofertas`).
    - Formulario de pasajeros y contacto (`PUT /ofertas/:id/pasajeros`) con normalización de caracteres, infantes vinculados a adultos y validación de documentos/edades.
    - Facturación fiscal (`PUT /ofertas/:id/facturacion`) según identificaciones del mercado (Cédula, RUC, CC, NIT, etc.).
    - Aceptación de términos y condiciones de transporte vigentes (`POST /ofertas/:id/condiciones`).
    - Revalidación de precio (`POST /ofertas/:id/revalidacion`) con modal de cambio de precio y aceptación (`POST /ofertas/:id/aceptacion-precio`).
    - Medios de pago (`GET /ofertas/:id/medios-pago`) y formulario de tarjeta con selector de tarjetas de prueba (`VITE_SHOW_TEST_CARDS=true`).
    - Compra y emisión de orden (`POST /ofertas/:id/compra`) con protección contra doble clic y reintento idempotente.
  - Pantalla 5: Confirmación de compra con orden comercial, PNR, e-tickets de 13 dígitos por pasajero, itinerario, estilo de impresión (`@media print`) y oferta de creación de cuenta.
  - Pantalla 6: Recuperación pública de orden (`GET /ordenes?numero=...&apellido=...` o `?pnr=...&apellido=...`) sin autenticación y datos de contacto protegidos.
  - Pantalla 7: Área de cuenta (registro, login, verificación de correo, preferencias y mis órdenes con cursor pagination).
  - Pruebas unitarias de utilidades críticas (dinero, fechas en zona horaria, mapeo de errores RFC 7807) y pruebas E2E con Playwright (camino feliz y reintento por rechazo de pago `tok_declined`).
  - Documentación en `README.md` con variables de entorno (`VITE_API_URL`, `VITE_SHOW_TEST_CARDS`) y despliegue en Vercel/Netlify.
- **No incluye:**
  - Alojamientos, autos o atracciones (alcance exclusivo: Vuelos).
  - Back-office / panel de administración.
  - Postventa (cambios de itinerario, reembolsos, equipaje adicional post-compra).
  - Check-in y emisión de tarjetas de embarque en vivo (retorna 501 en backend).
  - Mapa de asientos interactivo (retorna 501 o no requerido en R1).
  - Pasarelas de pago reales con procesamiento de tarjetas de crédito reales (pagos 100% simulados con tokens de prueba).

## Contexto y referencias
- **SRS E-commerce LATAM:** `src/modules/vuelos/docs/SRS_Plataforma_Ecommerce_LATAM.md` (Liberación R1: "Compra de vuelo").
- **Auditoría del módulo Vuelos:** `src/modules/vuelos/docs/AUDITORIA-VUELOS-10-4-2026(1).md`.
- **Instrucciones para Antigravity:** `src/modules/vuelos/docs/PROMPT-FRONTEND-ANTIGRAVITY.md` y `AGENTES.md`.
- **Contratos:** Endpoints de catálogo (`/localidades`, `/disponibilidad`, `/itinerarios/:id/tarifas`), ofertas (`/ofertas`, `/revalidacion`, `/pasajeros`, `/facturacion`, `/condiciones`, `/medios-pago`, `/compra`), órdenes (`/ordenes`), identidad (`/auth/login`, `/auth/invitado`, `/auth/verificar-correo`, `/clientes`), y mercados (`/mercados/:codigo`).

## Cambios previstos

| Archivo / módulo | Cambio |
|---|---|
| `frontend/package.json` | Configuración del proyecto frontend (Vite, React 18, TypeScript, Tailwind, TanStack Query, React Hook Form, Zod, Vitest). |
| `frontend/vite.config.ts` | Configuración de Vite con alias `@/`, servidor proxy para desarrollo local y configuración de build SPA estático. |
| `frontend/tailwind.config.js` y `frontend/src/styles/` | Definición de design tokens, paleta de colores de aerolínea (Navy índigo, Slate neutro, Esmeralda, Ámbar, Carmesí), tipografía, animaciones y soporte para modo claro. |
| `frontend/src/api/` | Cliente API Axios/Fetch con interceptores para `Authorization: Bearer`, `Idempotency-Key`, `X-Correlation-Id`, transformación de errores `application/problem+json` y cliente tipado con `openapi-typescript`. |
| `frontend/src/lib/` | Utilidades para dinero (`Intl.NumberFormat` sin decimales en COP/CLP y 2 en USD, sin aritmética de punto flotante), formateo de fechas con zona horaria de IATA, UUID v4 para idempotencia y almacenamiento de sesión seguro (`sessionStorage`). |
| `frontend/src/components/ui/` | Componentes reutilizables accesibles: `Button`, `Input`, `Select`, `Dialog`, `Popover`, `Stepper`, `Skeleton`, `Badge`, `MoneyText`, `Countdown`, `ProblemAlert`, `Toast`, `WakeUpBanner`. |
| `frontend/src/features/search/` | Barra de búsqueda de vuelos (`SearchBar`), autocompletado de aeropuertos (`AirportPicker`), selector de fechas (`DateRangePicker`), selector de pasajeros (`PassengerSelector`) y conmutador de mercado (`MarketSelector`). |
| `frontend/src/features/results/` | Pantalla de resultados (`ResultsPage`), tarjetas de vuelo (`FlightCard`), selector de ordenamiento (`SortSelector`), carrusel de fechas cercanas (`DateCarousel`) y estado vacío/sin disponibilidad (`EmptyState`). |
| `frontend/src/features/fares/` | Comparador de familias tarifarias (`FareFamiliesComparison`), tarjetas de familia (`FareFamilyCard`: BASIC, LIGHT, FULL) con matriz de características estructuradas. |
| `frontend/src/features/checkout/` | Flujo de checkout paso a paso con temporizador de expiración de oferta (`Countdown`), formulario de pasajeros (`PassengerForm`), facturación fiscal dinámica por país (`BillingForm`), términos legales (`ConditionsForm`), modal de cambio de precio (`PriceChangedModal`), y pasarela simulada con selector de tarjetas de prueba (`PaymentForm`). |
| `frontend/src/features/confirmation/` | Pantalla de confirmación (`OrderConfirmationPage`), localizador PNR destacado, lista de e-tickets por pasajero, itinerario detallado, botón de impresión y llamada a la acción para crear cuenta. |
| `frontend/src/features/orders/` | Búsqueda pública de orden por número/PNR + apellido (`RetrieveOrderPage`), y detalle de orden pública. |
| `frontend/src/features/account/` | Pantallas de login, registro, verificación de token por email, perfil de usuario y listado paginado por cursor de mis órdenes (`OrderHistoryPage`). |
| `frontend/tests/` | Pruebas unitarias de dinero, fechas y errores (Vitest), y pruebas E2E de flujo de compra y rechazo con tarjeta simulada (Playwright). |
| `frontend/README.md` | Guía de instalación, variables de entorno y despliegue gratuito en Vercel/Netlify. |

## Impacto en la API / contrato
**Ninguno**. El frontend se adapta 100% a la API existente y desplegada en Render sin requerir modificaciones en el backend ni en los contratos OpenAPI.

## Pasos de Implementación

### Fase 1: Arquitectura base, Design System y Conexión API
1. Inicializar la estructura del proyecto en `frontend/` con Vite, TypeScript, React Router v6, TanStack Query y Tailwind CSS.
2. Definir los tokens de diseño (colores primarios estilo aerolínea, neutros, estados semánticos, sombras, bordes y tipografía legible).
3. Configurar el generador de tipos OpenAPI (`openapi-typescript`) y crear el cliente HTTP base con:
   - Inyección automática de token Bearer (desde `sessionStorage` o memoria).
   - Generación y reutilización de `Idempotency-Key` UUID v4.
   - Captura y estructuración de respuestas de error RFC 7807 (`application/problem+json`).
   - Detección de servidor dormido en Render (con ping/warmup inicial y reintentos exponenciales).
4. Implementar utilidades base: `formatMoney(monto, moneda)` (COP/CLP sin decimales, USD con 2), `formatAirportDate(isoUtc, timeZone)`, generador de UUID v4.
5. Construir los componentes UI reutilizables del sistema de diseño (`Button`, `Card`, `Input`, `Dialog`, `Badge`, `MoneyText`, `Countdown`, `ProblemAlert`, `Skeleton`, `Toast`).

### Fase 2: Buscador de Vuelos y Resultados de Disponibilidad
1. Implementar el selector de mercado (`ec` Ecuador USD / `co` Colombia COP) sincronizado con el backend (`GET /mercados/:codigo`).
2. Desarrollar la barra de búsqueda (`SearchBar`):
   - Tipo de viaje: Ida y vuelta (RT) / Solo ida (OW).
   - Autocompletado de origen y destino con debounce (`GET /localidades?q=`), prevención de origen=destino y botón de intercambio (swap).
   - Selector de fechas con validaciones de fechas pasadas y coherencia ida-vuelta.
   - Selector de pasajeros (Adultos, Niños, Infantes; validación infantes <= adultos, total <= 9).
   - Sincronización completa con URL (`origin`, `destination`, `outbound`, `inbound`, `adt`, `chd`, `inf`, `trip`, `sort`, `mercado`).
3. Construir la pantalla de resultados (`ResultsPage`):
   - Consulta a `GET /disponibilidad` usando parámetros de URL.
   - Tarjetas de vuelo (`FlightCard`) con horarios en la zona horaria del aeropuerto, duración, operadora, badges (Recomendado, Más barato, etc.) y aviso de escasez.
   - Selector de días alternativos cuando aplique.
   - Selector de ordenamiento (`RECOMENDADO`, `MAS_BARATOS`, `MAS_RAPIDOS`, etc.).
   - Manejo de estados de carga (skeletons), sin disponibilidad (`sinDisponibilidad: true`) y reintento ante errores de red.

### Fase 3: Tarifas y Flujo de Checkout con Retención de Cupo
1. Construir el modal/vista de familias tarifarias (`TarifasView` con `GET /itinerarios/:id/tarifas`):
   - Comparador de columnas BASIC, LIGHT, FULL con sus condiciones estructuradas (equipaje mano/bodega, cambios, reembolsos, asiento).
   - Desglose detallado de precio por tipo de pasajero (base + impuestos).
2. Construir la pantalla de Checkout con Stepper interactivo y barra lateral fija con resumen y cuenta regresiva (`Countdown` con `venceEn`):
   - **Paso 1 (Creación de Oferta):** Autenticación transparente como invitado (`POST /auth/invitado`) si no hay sesión, y creación de oferta (`POST /ofertas` con `Idempotency-Key`).
   - **Paso 2 (Pasajeros y Contacto):** Formulario dinámico con React Hook Form + Zod para cada pasajero (nombres, apellidos, fecha de nacimiento, género M/F/X, nacionalidad, documento PASSPORT/NATIONAL_ID con vencimiento, vinculación de infantes a adultos y datos de contacto E.164). Guardado vía `PUT /ofertas/:id/pasajeros`.
   - **Paso 3 (Facturación):** Formulario fiscal adaptado dinámicamente a los tipos de identificación del mercado activo (`PUT /ofertas/:id/facturacion`).
   - **Paso 4 (Condiciones):** Visualización y aceptación obligatoria de los términos y condiciones de transporte vigentes (`POST /ofertas/:id/condiciones`).
   - **Paso 5 (Revalidación de Precio):** Llamada a `POST /ofertas/:id/revalidacion`. Si hay cambio de precio, mostrar modal comparativo de precios y requerir aceptación con `POST /ofertas/:id/aceptacion-precio`.

### Fase 4: Medios de Pago Simulados, Compra y Confirmación
1. Implementar la sección de pago:
   - Consulta de medios permitidos (`GET /ofertas/:id/medios-pago`).
   - Formulario de tarjeta con validación visual (Luhn para UX realista, marcas de tarjeta y selector de cuotas permitidas según el mercado).
   - Componente selector de "Tarjeta de prueba" (controlado por `VITE_SHOW_TEST_CARDS=true`) con tokens:
     - Éxito: `tok_visa_ok`, `tok_mastercard_ok`, `tok_amex_ok`, `tok_diners_ok`.
     - Rechazo: `tok_declined`, `tok_insufficient`, `tok_expired`, `tok_3ds`, `tok_fraud`, `tok_review`.
     - Falla de captura: `tok_visa_capture_fail`.
   - Envío de `POST /ofertas/:id/compra` con `Idempotency-Key`, deshabilitando botón durante el envío.
   - Manejo de rechazos (402): la oferta permanece activa y permite intentar con otra tarjeta sin perder los datos ya llenados.
2. Construir la pantalla de confirmación:
   - Visualización de número de orden comercial (`ORD-...`), PNR (6 caracteres), billetes electrónicos (13 dígitos) por pasajero, itinerario y total pagado.
   - Aviso de correo enviado con los datos.
   - Hoja de estilos para impresión (`@media print`) para generar comprobante físico o PDF limpio.
   - Opción para que el usuario invitado cree una cuenta con un clic tras la compra.

### Fase 5: Recuperación Pública de Órdenes, Autenticación y Cuenta
1. Implementar pantalla de recuperación de orden (`/recuperar-orden`):
   - Formulario con número de orden o PNR + apellido obligatorio.
   - Consumo de `GET /ordenes?numero=...&apellido=...` o `?pnr=...&apellido=...`.
   - Manejo amigable de 404 (mensaje genérico que protege la privacidad) y límite de tasa 429.
2. Implementar módulo de cuenta de usuario:
   - Registro de cliente (`POST /clientes`) y verificación de correo (`POST /auth/verificar-correo`).
   - Inicio de sesión (`POST /auth/login`) con bloqueo tras 5 intentos (`423 ACCOUNT_LOCKED`).
   - Perfil y preferencias del cliente (`GET /clientes/me`, `PUT /clientes/me/preferencias`).
   - Historial de viajes ("Mis viajes") con paginación por cursor (`GET /clientes/me/ordenes?limit=...&cursor=...`) y detalle de orden propia (`GET /ordenes/:numero`).

### Fase 6: Pruebas, Accesibilidad WCAG 2.1 AA y Despliegue
1. Escribir pruebas unitarias con Vitest:
   - Formateo de dinero por mercado (COP vs USD).
   - Formateo y conversiones de fechas en zonas horarias.
   - Traducción y mapeo de errores RFC 7807 a mensajes en español e inline form errors.
2. Escribir pruebas E2E con Playwright:
   - Flujo completo (camino feliz): búsqueda -> selección de vuelo -> selección de tarifa -> datos de pasajeros -> facturación -> pago con `tok_visa_ok` -> pantalla de confirmación con PNR y e-ticket.
   - Flujo de rechazo de pago: pago con `tok_declined` -> mensaje de error claro -> reintento con `tok_visa_ok` -> confirmación exitosa sin duplicar orden.
3. Auditoría de accesibilidad:
   - Atributos ARIA, contraste de color, foco visible, navegación completa por teclado, anuncios `aria-live`.
   - Comprobación de puntuación Lighthouse >= 90 en Inicio, Resultados y Checkout.
4. Generar documentación en `frontend/README.md` detallando variables de entorno y guía paso a paso para despliegue en Vercel o Netlify.

## Riesgos y decisiones abiertas
- **Tiempo de encendido en Render:** El backend gratuito se suspende por inactividad y tarda entre 40 y 50 segundos en despertar. *Mitigación:* Se implementó el monitor de cliente y el banner global animado (`WakeUpBanner`).
- **Idempotencia en pagos y compras:** Errores de red o doble clic del usuario podrían enviar solicitudes duplicadas. *Mitigación:* Generación de UUID v4 con `generateUUID()` y reutilización de la misma clave ante reintentos.
- **Separación de paquetes:** Proyecto modular en `frontend/` sin alterar el backend de NestJS ni sus dependencias.

## Verificación
- **Unitarias:** Ejecutar `npm run test` en el frontend para validar helpers de dinero, fechas y errores problem+json.
- **E2E:** Pruebas del camino feliz de compra y rechazo con tarjeta simulada.
- **Manual:**
  - Búsqueda en mercado Ecuador (`USD`, 2 decimales) y Colombia (`COP`, sin decimales).
  - Creación de oferta y expiración con temporizador visible.
  - Pago con tarjeta de prueba aprobada (`tok_visa_ok`) y rechazada (`tok_declined`).
  - Recuperación pública con PNR y apellido.
  - Auditoría Lighthouse de Accesibilidad (>= 90).
- **Criterio de terminado:** El camino feliz completo funciona fluidamente contra la API en vivo o local, sin errores de consola, con diseño responsive de alta calidad y respetando todas las reglas de negocio del SRS.
