# Auditoría no destructiva de frontend — accesibilidad y responsive

> **Archivo:** `src/modules/vuelos/docs/AUDITORIA-10-6-2026-Frontend.md` · **Fecha:** 2026-10-06
> **Alcance:** `frontend/src` (shell, rutas, layout, UI kit, features: search, results, fares, checkout, confirmation, verify, orders, account, admin, legal; `lib/*`, `api/*`, `styles/index.css`, `tailwind.config.js`, `index.html`). Excluye `node_modules/` y `dist/`.
> **Método:** solo lectura, sin ejecutar el navegador. No se modificó ningún archivo existente; este informe es el único archivo creado en esta pasada. Cada problema citado corresponde a código realmente leído; los criterios que cumplen se indican explícitamente.
> **Criterios mínimos revisados:** estructura semántica, jerarquía de encabezados, nombres accesibles, textos alternativos, contraste, navegación con teclado, foco visible, botones vs enlaces, ARIA, objetivos táctiles, navegación móvil, overflow horizontal, imágenes/QR, errores JavaScript y comportamiento en 320 px, 390 px, 768 px y escritorio.

---

## 1. Resumen ejecutivo

Base sana: `lang="es"`, viewport con zoom permitido, landmarks (`header`/`main#contenido`/`footer` + `nav` etiquetados), skip-link, un `h1` por página, `:focus-visible` global, formularios buenos donde se usó el UI kit (`PaymentForm`, `RetrieveOrderPage`, registro con `zodResolver`), `SeatMap` con asientos-botón etiquetados, QR con `role="img"` + `aria-label`, `ErrorBoundary` en el `Outlet`, sin promesas flotantes ni PII en consola, y responsive mayoritario (grillas 1→2→N columnas, `DateStrip` con scroll intencional, summary no-sticky en móvil).

Bloqueos reales para teclado y lector de pantalla: el `AirportPicker` usa un listbox custom cuyas opciones no son focables y sin flechas/`Escape`/`activedescendant` (búsqueda bloqueada por teclado); el `Dialog` genérico no implementa trampa de foco, foco inicial ni retorno (afecta a todos los modales, y `FareComparisonModal` ni siquiera maneja `Escape`); `PassengerForm`/`BillingForm` tienen `label` sin `htmlFor`, inputs sin `id` y errores `<p>` sin `role`/`id` (checkout no anunciable); y los cambios de página/éxito/error nunca mueven el foco (solo `scrollTo`). A ello se suman objetivos táctiles <44 px sistemáticos, 4–6 combinaciones de contraste <4.5:1 y tablas con scroll no focable (admin) o sin scroll (legal, que desborda la página en 320 px).

**Distribución:** 4 críticos · 6 altos · 8 medios · 6 bajos. Los "cumple" de cada criterio se listan en §2.5.

---

## 2. Hallazgos

### 2.1 Críticos (bloquean teclado o lector en flujos principales)

| ID | Hallazgo |
|----|----------|
| C1 | `AirportPicker`: listbox custom no operable por teclado (opciones no focables, sin flechas/`Escape`/`activedescendant`, input sin etiqueta) |
| C2 | `Dialog` sin trampa de foco, sin foco inicial y sin retorno al disparador; overlay con `<div onClick>`; `FareComparisonModal` custom sin `Escape`/foco |
| C3 | `PassengerForm` y `BillingForm`: `label` sin `htmlFor`, inputs sin `id`/`aria-invalid`/`aria-describedby`, errores `<p>` sin `role`/`id` |
| C4 | Sin gestión de foco en navegación ni en éxito/error (rutas, `ErrorBoundary`, login/registro, reintentos `ProblemAlert`) |

### 2.2 Altos (anuncios, estados, contraste, táctil)

| ID | Hallazgo |
|----|----------|
| A1 | Estados sin exponer: toggle ida/vuelta, `DateStrip`, `DateNavigator` (7 días), `CheckoutStepper` y `SortingBar` sin `aria-pressed`/`aria-current`/live |
| A2 | `Select` sin `aria-describedby` (el error `role="alert"` no está asociado); `label?` opcional en `Input`/`Select` permite campos solo-placeholder |
| A3 | Contrastes <4.5:1: `Button secondary`, `Badge secondary`, legal de footer 11 px, "copiar código" de `ProblemAlert`, placeholder |
| A4 | Objetivos táctiles <44 px sistemáticos: `Button sm/md`, hamburguesa, cerrar modal, acciones de `ProblemAlert`, mostrar contraseña, links de footer |
| A5 | Tablas admin con scroll no focable (`overflow-x-auto` sin `tabindex`/`role`/`aria-label`); tablas legales sin wrapper → desbordan la página en 320 px |
| A6 | `DateNavigator` prev/next solo-icono en móvil (`title`, sin `aria-label`); iconos decorativos sin `aria-hidden` en varios archivos |

### 2.3 Medios (verborrea live, grillas, modales puntuales, responsive justo)

| ID | Hallazgo |
|----|----------|
| M1 | `Countdown` anuncia MM:SS cada segundo (`role="timer"` + `aria-live="polite"`) + `animate-pulse` |
| M2 | Sin anuncios: conteo de `SortingBar`, resultado de `RetrieveOrderPage`, conteos de `PassengerSelector` |
| M3 | `SeatMap` solo tabulable asiento por asiento (sin `grid`/flechas); tabs de `SeatSelector` sin `aria-controls`/`tabpanel` |
| M4 | `PriceChangedModal`: `grid-cols-2` fijo (estrecho en 320 px); `onClose` noop deja `Escape`/X inertes por diseño pero sin comunicarlo |
| M5 | Píldoras de `LegalLayout` sin `aria-current="page"`; `CardBrandLogo` sin `flex-wrap`; píldoras admin sin `wrap`; fechas de `SearchBar` justas en 320 px |
| M6 | `Button` sin `type` por defecto; cerrar de `Dialog` y CTAs de `FlightCard`/`FareFamilyCard`/`ResultsPage` sin `type` explícito |
| M7 | `ProblemAlert` usa `<h4>` sin jerarquía garantizada; `figcaption` QR en 10 px; overlay de `Dialog` sin alternativa de teclado |
| M8 | `main#contenido` sin `tabindex="-1"` (skip-link solo hace scroll); contenido de `Dialog` sin `max-h`/`overflow-y-auto` |

### 2.4 Bajos (higiene y restos)

| ID | Hallazgo |
|----|----------|
| B1 | Entrada muerta de modal: `CheckInResponseDto`-like `NOT_ELIGIBLE`/`FAILED` no aplica aquí; en frontend equivale a `Dialog` con `describedby` opcional sin contenido |
| B2 | `Skeleton` oculto sin anuncio paterno (`role="status"`/`aria-busy` del contenedor) |
| B3 | Barra de `WakeUpBanner` sin `progressbar` (aceptable si es decorativa; documentarlo) |
| B4 | `Header`: logo + `tracking-[0.32em]` puede apretarse en 320 px (sin `min-w-0`/`truncate`); `gold` activo pequeño en `uppercase` |
| B5 | `Card` sin `min-w-0`/`overflow-hidden` (riesgo solo si el consumidor mete tabla ancha) |
| B6 | `RouteEffects` fija `document.title` genérico sin título por ruta |

### 2.5 Criterios que CUMPLEN (con evidencia)

- **Estructura semántica:** `routes/index.tsx:33-42` (`Header`→`<header>`, `<main id="contenido">`, `Footer`→`<footer>`); `Header.tsx:37,51,107` (`<header>` + 2 `nav` etiquetados); `Footer.tsx:41,52`; `CheckoutSummary.tsx:21` (`aside` resumen); `SeatSelector.tsx:64` (`section` etiquetada); `LegalLayout.tsx:31,47-48` (`nav` legal + `article`/`header`).
- **Jerarquía:** `h1` único por página (`NotFoundPage.tsx:13`, `HomePage.tsx:54`, `ConfirmationPage.tsx:68`, `VerifyTicketPage.tsx:23`, `ErrorBoundary.tsx:24`, `LegalLayout.tsx:49`); legales solo `h2`/`h3` sin saltos (`Terms/Privacy/Transparency/TransportConditions`).
- **Nombres accesibles donde hay `label` asociado:** `PaymentForm.tsx:210-314` (`htmlFor`/`id` + `aria-invalid`/`aria-describedby` + `role="alert"` condicional); `SortingBar.tsx:35-39`; `DateNavigator.tsx:107`; `RetrieveOrderPage.tsx:89-104` vía `Input.tsx:19-21,44-45,55`; registro con `error={errors.*}` (`RegisterPage.tsx:129-175`); show/hide password con `aria-pressed` + texto (`LoginPage.tsx:73-81`, `RegisterPage.tsx:178-186`); toggles admin con `aria-pressed` (`AdminObservabilityPage.tsx:113-125`); `SeatMap.tsx:44-51` (nombre + `aria-pressed`); copiar PNR con `aria-label` + `role="status"` (`ConfirmationPage.tsx:127-138`).
- **Alternativos:** logos con `role="img"` + `aria-label` (`Logo.tsx:18`, `CardBrandLogo.tsx:14-66` en lista etiquetada); QR con nombre por pasajero + `figure/figcaption` (`TicketQr.tsx:14-18`); decorativos ocultos (`NotFoundPage.tsx:12`, `ProblemAlert.tsx:38`, `TicketQr` leyenda, `WakeUpBanner.tsx:22`, `EmptyState.tsx:41`, `SeatMap.tsx:93-110`).
- **Contraste base:** `index.html:14` (`bg-slate-50`/`text-slate-800`); botones `primary/accent/outline`, badges `success/warning/danger`, countdown sobre pasteles, `WakeUpBanner` (`#F4EFE4`/`black`) — cumplen.
- **Foco visible:** regla global `styles/index.css:11-13` + `Button.tsx:25`, `Input.tsx:36`, `Select.tsx:31-37` (matiz: color `gold` ~2.5:1, existe pero justo).
- **Botones vs enlaces:** navegación con `<Link>` (`NotFoundPage`, `HomePage`, `Footer`, `LegalLayout` imprimir como `<button>`); menu/logout/hamburguesa como `<button type="button">` (`Header.tsx:75,92`); sin `<div onClick>` salvo overlay de `Dialog` (hallazgo C2) y triggers custom (hallazgo C1).
- **Navegación móvil:** hamburguesa `lg:hidden` con `aria-expanded`/`aria-controls` + cierre al navegar (`Header.tsx:92-107,27`); grillas `flex-col→sm:flex-row`, `grid-cols-1→sm/md/lg` en home, resultados, checkout (`grid-cols-1 lg:grid-cols-3`, summary no-sticky en móvil `:167`), confirmación, auth (`AuthShell`, `RegisterPage`), observabilidad; `DateStrip` con scroll intencional (`overflow-x-auto`).
- **Sin overflow global:** sin `w-screen`; contenedores `max-w-*` + `px-4/6`; `SeatMap` `w-fit` cabe en 320 px; checkout sin `overflow-x`.
- **Imágenes:** solo SVG/favicons + QR canvas con alternativa; sin `<img>` sin `alt` (no hay `<img>` de contenido).
- **Errores JS:** sin promesas flotantes (`VerifyEmailPage.tsx:20-22`, `LoginPage.tsx:36-42`, `api/client.ts:64-120` con `SERVICE_UNAVAILABLE` tipado, `storage.ts` con `try/catch`, `queryClient.ts:8-13` sin reintentar 4xx); `ErrorBoundary` cubre el `Outlet`; `ProblemAlert` no fuga `detail` inglés (usa `getFriendlyErrorMessage`); `console.error` solo en dev sin PII (`ErrorBoundary.tsx:17`).
- **Estados no solo-color:** badges con texto, asientos con `aria-label` + `×`/letra, stepper/observabilidad con texto además de color.

---

## 3. Evidencia concreta (archivo y elemento afectado)

### C1 — `AirportPicker` no operable por teclado

- **Archivo:** `frontend/src/features/search/AirportPicker.tsx:59-66` — `<label>` sin `htmlFor`; trigger `div role="button" tabIndex={0}` con `onKeyDown` solo `Enter/' '` (`:71-76`), `aria-haspopup="listbox" aria-expanded` (`:84-85`) pero sin `Escape`, sin flechas, sin `aria-activedescendant`.
- **Archivo:** `frontend/src/features/search/AirportPicker.tsx:123-130` — `input[type=text]` con solo `placeholder`, sin `id`/`label`/`aria-label`.
- **Archivo:** `frontend/src/features/search/AirportPicker.tsx:135-142` — contenedor `role="listbox"` con `div role="option" aria-selected` no focables y solo `onClick`; sin `aria-modal`/trampa.
- **Archivo:** `frontend/src/features/search/AirportPicker.tsx:115` — `<p class="text-red-600">` de error sin `role`/`id`, trigger sin `aria-invalid`/`aria-describedby`.
- **Mismo patrón:** `frontend/src/features/search/PassengerSelector.tsx:81-99` (`label` sin `htmlFor`, `div role="button"` + `aria-haspopup="dialog"` sin `Escape`); conteos `:131,160,189` sin `aria-live`.

### C2 — `Dialog` sin gestión de foco

- **Archivo:** `frontend/src/components/ui/Dialog.tsx:23-36` — `Escape` + bloqueo de scroll, pero sin focus-trap, sin foco inicial (`autoFocus`/`ref.focus()`), sin guardar/restaurar `previouslyFocused`.
- **Archivo:** `frontend/src/components/ui/Dialog.tsx:47-58` — contenedor `role="dialog" aria-modal="true" aria-labelledby` (`:49-51` cumple) + overlay `<div onClick={onClose} aria-hidden="true">` (`:54-58`, `<div onClick>` sin rol/teclado).
- **Archivo:** `frontend/src/components/ui/Dialog.tsx:76-84` — botón cerrar sin `type="button"` (`:76`), `p-1.5` ≈ 32 px; contenido `:84` sin `max-h-[80-90vh] overflow-y-auto`.
- **Agravante:** `frontend/src/features/fares/FareComparisonModal.tsx:36-42` — modal custom con `role="dialog"` (`:36-40` cumple) pero sin `Escape`, sin foco, backdrop `div onClick`; `Dialog.tsx` sí tiene `Escape`, aquí no se reutiliza.

### C3 — Formularios de checkout sin asociación

- **Archivo:** `frontend/src/features/checkout/PassengerForm.tsx:253-255,272,294,314,326,345,358,379,412,434` — `<label>` sin `htmlFor`; inputs `register` (`:256-264,276-284,297-305`) sin `id`/`aria-invalid`/`aria-describedby`.
- **Archivo:** `frontend/src/features/checkout/PassengerForm.tsx:266-268,285-287,306-310,371-375,428-430,450-452` — errores `<p class="text-red-600">` sin `role="alert"` ni `id` (contrasta con `PaymentForm.tsx:231` que sí lo hace).
- **Archivo:** `frontend/src/features/checkout/BillingForm.tsx:97,116,136,156,175` (labels) + `:100-102,119-128` (inputs) + `:110-112,129-131,149-151,169-171` (errores) — mismo patrón; `SearchBar.tsx:188-212` (labels `Ida`/`Vuelta` sin `htmlFor`, inputs date sin `id`) y `originError/destinationError` delegados al `<p>` plano de `AirportPicker.tsx:115`.
- **Contraste positivo:** `frontend/src/features/checkout/PaymentForm.tsx:193,210-314` (`<form novalidate>`, `htmlFor`/`id`, `aria-invalid`/`aria-describedby`, `role="alert"`, `type="submit"`, `aria-expanded`) — replicar este patrón.

### C4 — Sin movimiento de foco

- **Archivo:** `frontend/src/routes/RouteEffects.tsx:9-24` — `scrollTo`/`scrollIntoView` + `document.title`, sin `tabIndex={-1}`/`.focus()` ni `aria-live`.
- **Archivo:** `frontend/src/routes/index.tsx:37` — `<main id="contenido">` sin `tabindex="-1"` (el skip-link `Header.tsx:38-42` solo hace scroll).
- **Archivo:** `frontend/src/components/common/ErrorBoundary.tsx:24-26` — `h1` sin foco programado; `NotFoundPage.tsx:13`; formularios `LoginPage.tsx:31-45`, `RegisterPage.tsx:44-119`, `AddTripForm.tsx:24-62` (`role="status"` sin foco); reintentos `ProblemAlert` (`ProfilePage.tsx:34`, `OrderHistoryPage.tsx:40`, admin) sin devolver foco.

### Altos

- **A1:** `SearchBar.tsx:104-125` (toggle sin `aria-pressed`); `DateStrip.tsx:35-43` (selección solo visual); `DateNavigator.tsx:79-96,134-142` (días/prev-next sin `aria-pressed/current`; etiquetas en `hidden sm:inline :87,96`); `CheckoutStepper.tsx:28-49` (`nav`+`ol` cumplen, paso solo color sin `aria-current="step"`); `SortingBar.tsx:28-31` (conteo sin `aria-live`).
- **A2:** `Select.tsx:37-57` (falta `aria-describedby`; `Input.tsx:45` sí lo tiene); `Input.tsx:5` / `Select.tsx:5` (`label?` opcional + `placeholder:text-slate-400` de bajo contraste como riesgo si se omite `label`).
- **A3:** `Button.tsx:29` (blanco sobre `#0284C7` ~3.6:1); `Badge.tsx:18` (`#E0F2FE`/`#0284C7` ~3.5:1); `Footer.tsx:67-68` (`text-[11px] text-slate-500` sobre `#0B0E14` ~3.9:1); `ProblemAlert.tsx:61` (`text-[11px] text-red-500` sobre `red-50` ~3.3:1); `index.css` focus `gold` ~2.5:1 y selección ~2.8:1 (estados, no texto).
- **A4:** `Button.tsx:37-38` (`sm` ≈ 28 px, `md` ≈ 40 px); `Header.tsx:94` (hamburguesa ≈ 40 px), `:16` (links desktop ≈ 32 px); `Dialog.tsx:76` (≈ 32 px); `ProblemAlert.tsx:56,61` (≈ 16 px); `LoginPage.tsx:73-76` / `RegisterPage.tsx:178-182` (≈ 18–20 px); `Footer.tsx:57` (solo texto); `NotFoundPage.tsx:16` (≈ 40 px, aceptable ≥24 px pero <44 px).
- **A5:** `AdminOrdersPage.tsx:68` (`overflow-x-auto` + `table min-w-[720px] :68-78`, `th` sin `scope`, sin `caption`); `AdminFlightsPage.tsx:104-115` (`min-w-[760px]`, 7 `th` sin `scope`; diálogo `:30,38-44` igual); `AdminObservabilityPage.tsx:249-257` (igual); wrappers sin `tabindex="0"`/`role="region"`/`aria-label`; `PrivacyPage.tsx:10-11`, `TransparencyPage.tsx:22-23,34-35` (tablas sin wrapper → desbordan página en 320 px).
- **A6:** `Header.tsx:100` (`Menu`/`X` sin `aria-hidden`); `Button.tsx:49` (`Loader2` sin `aria-hidden`/`aria-busy`); `Select.tsx:49` (`ChevronDown`); `Countdown.tsx:65` (`Clock`); `FlightCard.tsx:42,47,52,60,87`; `DateStrip.tsx:22`; `CheckoutPage.tsx:92`; `RetrieveOrderPage.tsx:114`.

### Medios y bajos (evidencia puntual)

- **M1:** `Countdown.tsx:62-66` (`role="timer"` + `aria-live="polite"` + MM:SS cada segundo) + `animate-pulse :56`; uso en `CheckoutSummary.tsx:29-33`.
- **M2:** `SortingBar.tsx:28-31`; `RetrieveOrderPage.tsx:89-116` (sin live tras buscar); `PassengerSelector.tsx:131,160,189`.
- **M3:** `SeatMap.tsx:44-60` (botones cumplen; contenedor `role="group"`, sin `grid`/flechas; `focus-visible:ring :52` cumple); `SeatSelector.tsx:78-84,99-111` (tabs/radios sin `aria-controls`/`tabpanel`).
- **M4:** `PriceChangedModal.tsx:45,59-85,89-103` (`grid-cols-2` fijo; `onClose` noop).
- **M5:** `LegalLayout.tsx:31-45` (píldoras sin `aria-current`); `CardBrandLogo.tsx:66` (`flex` sin `wrap`); `AdminLayout.tsx:27` (nav sin `wrap`); `SearchBar.tsx:185,192,214` (fechas `grid-cols-2` justas en 320 px).
- **M6:** `Button.tsx:43-47` (sin `type` por defecto); `ResultsPage.tsx:200,231,264`, `FlightCard.tsx:141`, `FareFamilyCard.tsx:140` (sin `type`).
- **M7:** `ProblemAlert.tsx:40` (`h4`); `TicketQr.tsx:18` (`figcaption` 10 px, ratio justo ~4.7:1 pero poco legible); `Dialog.tsx:67` (`h3` en modal).
- **M8:** `index.tsx:37` (ver C4); `Dialog.tsx:84` (ver C2).
- **B2–B6:** `Skeleton.tsx:6-10` (`aria-hidden`, anunciar en padre); `WakeUpBanner.tsx:19-26` (`role="status"` cumple; barra `aria-hidden` sin `progressbar`); `Logo.tsx:18-26` (cumple; riesgo 320 px solo wordmark); `Card.tsx:10-16` (sin `onClick` aquí); `RouteEffects.tsx:21` (título genérico).

---

## 4. Recomendación de corrección para cada hallazgo

| ID | Recomendación |
|----|---------------|
| C1 | Sustituir el listbox custom por `<select>` nativo o implementar combobox ARIA completo: `input` con `role="combobox"` + `aria-expanded`/`aria-controls`/`aria-activedescendant`, opciones focables con flechas + `Enter` + `Escape`, `aria-label` al input y errores con `role="alert"` + `aria-describedby`. Aplicar igual a `PassengerSelector` (o usar `aria-live` en conteos + `Escape`). |
| C2 | Centralizar en `Dialog`: trampa de foco (Tab circular), foco inicial al primer control/título, `Escape`, retorno al disparador, `type="button"` en cerrar, `max-h-[85vh] overflow-y-auto` en contenido y overlay como botón o contenedor con `e.target===e.currentTarget`. Migrar `FareComparisonModal` a `Dialog` o copiar el mismo comportamiento. |
| C3 | Replicar el patrón `PaymentForm`: `id` por campo + `<label htmlFor>`, `aria-invalid` + `aria-describedby` a `<p id role="alert">`. Hacer `label` obligatorio en `Input`/`Select` (o exigir `aria-label` si se omite) y asociar `originError/destinationError/dateError`. |
| C4 | Al cambiar de ruta, mover foco al `h1`/`main` (`tabIndex={-1}` + `.focus()`, con `main#contenido` focable solo por script); al mostrar éxito/error, mover foco al `role="status"`/`alert` o gestionarlo con `aria-live` + foco en el primer campo inválido; tras `Reintentar`, devolver foco a la alerta o al contenido cargado. |
| A1 | `aria-pressed` en toggle ida/vuelta, `DateStrip` y días de `DateNavigator`; `aria-current="step"` (o `date`) en `CheckoutStepper`; `aria-live="polite"` en conteo de `SortingBar`; `aria-label` (no solo `title`) en prev/next. |
| A2 | Añadir `aria-describedby` en `Select` (igual que `Input.tsx:45`); exigir etiqueta visible o `aria-label` (nunca solo `placeholder`); `aria-hidden="true"` en `ChevronDown`. |
| A3 | Medir con APICA/axe y ajustar tokens: oscurecer `airline-blue` para texto blanco, oscurecer texto de `Badge secondary`, subir legal de footer a `text-xs slate-400+`, cambiar "copiar código" a `red-700` y ≥12 px, no usar `placeholder` como única etiqueta. |
| A4 | Subir a ≥44×44 los controles críticos (mostrar contraseña, reintentar/copiar, cerrar modal, hamburguesa, CTAs `sm/md` donde aplique) o documentar excepción con espaciado ≥24 px (WCAG 2.5.8) donde sea secundario. |
| A5 | Envolver cada tabla con scroll en `div tabindex="0" role="region" aria-label="…" class="overflow-x-auto"`; añadir `<caption>` (o `aria-label`) y `scope="col"` a `th`; en legal, envolver tablas en `overflow-x-auto` (o apilar a lista en móvil). Evitar `<tr onClick>` paralelo al botón interno. |
| A6 | `aria-label` en prev/next (visible en móvil); `aria-hidden="true"` en todos los iconos decorativos; `aria-busy`/`aria-live` en `Button isLoading` + ocultar spinner. |
| M1 | `aria-live="off"` en el segundero + anuncio en umbrales (p. ej. 5 min, 1 min) o `aria-atomic` con resumen por minuto; quitar `animate-pulse` cuando hay live. |
| M2 | `aria-live="polite"` en conteo de resultados, resultado de recuperación y conteos de pasajeros (o `role="status"`). |
| M3 | Aceptable hoy con Tab (cumple básico); si se evoluciona, `role="grid"` + flechas; añadir `aria-controls`/`tabpanel` a tabs de trayecto. |
| M4 | `grid-cols-1 sm:grid-cols-2` en el modal; comunicar bloqueo (`aria-disabled` + texto "elige una opción para continuar") ya que `Escape`/X son noop. |
| M5 | `aria-current="page"` en píldora legal activa; `flex-wrap` en marcas y nav admin; en 320 px verificar fechas (1 columna o `min-w-0`). |
| M6 | Fijar `type="button"` por defecto en `Button` (salvo `submit` explícito) y en todos los `<button>` fuera de formularios. |
| M7 | Cambiar `<h4>` de alerta por `<p><strong>`; subir `figcaption` a 11–12 px; `h3` de `Dialog` aceptable si cuelga de `h1` (documentarlo). |
| M8 | `tabindex="-1"` en `main#contenido`; `max-h` + scroll interno en `Dialog`. |
| B2 | Envoltorio de carga con `role="status"`/`aria-busy` donde se use `Skeleton`. |
| B3 | Si el % de `WakeUpBanner` es informativo, `role="progressbar"` + `aria-valuenow`; si no, documentar como decorativo. |
| B4 | `min-w-0`/`truncate` o `shrink-0` en marca + título de `Header` para 320 px. |
| B5 | `min-w-0` en `Card` o `overflow-hidden` donde pueda recibir tablas. |
| B6 | Título por ruta (`Helmet` o mapa en `RouteEffects`: p. ej. "Buscar · RAM Alliance"). |

---

## 5. Pruebas que deberían repetirse después de corregir

### 5.1 Teclado (sin ratón, sin lector)

1. **Búsqueda completa solo con Tab/Enter/Escape:** foco visible en cada parada (C1, §4-C1); `AirportPicker` abre con `Enter`, navega con flechas, elige con `Enter`, cierra con `Escape`; `PassengerSelector` igual; toggle ida/vuelta con `Espacio`; swap con `Enter`.
2. **Modales:** al abrir, foco dentro (C2); `Tab` no escapa (trampa); `Escape` cierra (salvo `PriceChangedModal`, que debe anunciarlo); al cerrar, foco vuelve al disparador (`Dialog`, `FareComparisonModal`, diálogos admin).
3. **Checkout SR/teclado:** cada error mueve foco al primer campo inválido y se anuncia (`PassengerForm`, `BillingForm`, `SearchBar`, `LoginPage`, checkbox términos); `PaymentForm` sigue pasando como referencia.
4. **Tablas con scroll:** en 320/390 px, cada `overflow-x-auto` entra en orden de tab (`tabindex="0"` + `role="region"`) y desplaza con flechas (A5); legales ya no desbordan la página.

### 5.2 Lector de pantalla (NVDA/VoiceOver) + axe

5. **Anuncios:** cambio de página (título + `h1`); `role="alert"` en errores de campo y `ProblemAlert`; `role="status"` en éxitos (registro, añadir viaje, copiar PNR, verificación válida/inválida); conteos (`SortingBar`, pasajeros, recuperación) sin verborrea; `Countdown` solo en umbrales (M1).
6. **Estados:** `aria-pressed` (toggle, fechas, ventana admin), `aria-current="step"/"page"` (stepper, legal, tabs), `aria-selected`/`checked` (trayectos, radios de pasajero), `aria-busy` en botones `isLoading` (A6).
7. **Nombres:** `axe-core`/`pa11y` en 0 violaciones críticas; todos los inputs con etiqueta programática (A2, C3); iconos decorativos sin nombre; QR/logo/marcas con `aria-label`; prev/next con nombre en móvil.
8. **Contraste:** medir con APICA los tokens A3 (`Button/Badge secondary`, footer 11 px, copiar, placeholder, ámbar-700/slate-500 en 11–12 px) y adjuntar capturas ≥4.5:1 (3:1 en foco/large).

### 5.3 Táctil, responsive y JS

9. **Objetivos:** muestreo ≥44×44 en mostrar-contraseña, reintentar/copiar, cerrar, hamburguesa, CTAs y paginadores (A4); resto ≥24 px con espaciado (WCAG 2.5.8).
10. **Responsive 320 / 390 / 768 / escritorio:** matriz por página (home, resultados, tarifas, checkout+seatmap, confirmación, login/registro, cuenta, admin ×3, legal ×6, verify, 404): sin overflow horizontal de `document` (salvo `DateStrip` interno), `PriceChangedModal` 1 col en 320 (M4), tablas admin con scroll focable, legales sin corte, seatmap usable sin tapa del summary, header sin solape en 320.
11. **JS limpio:** consola sin errores ni warnings en los flujos (búsqueda → compra → verificación; login → perfil → historial; admin; legal); `ErrorBoundary` muestra `h1` + enlace con foco; reintentos de red anuncian y devuelven foco; sin PII en logs (solo dev, sin correo/token).
12. **Regresión visual:** capturas 320/390/768/1440 de header+hero, resultados, seatmap, summary, admin y legal; foco `:focus-visible` visible en cada captura de teclado.

> **Criterio de cierre:** §5.1–5.2 en CI por PR (axe + checklist de teclado en las rutas tocadas); §5.3 antes de declarar RDA2. Guardar reportes axe + matriz de viewports junto a este informe.
