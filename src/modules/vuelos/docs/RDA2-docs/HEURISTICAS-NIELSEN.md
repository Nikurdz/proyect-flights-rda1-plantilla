# Las 10 heurísticas de Nielsen en el frontend de RAM Alliance

Documento de evidencia para la revisión del curso. Describe cómo el frontend (`frontend/`, React + Vite + Tailwind) cumple cada heurística de usabilidad de Jakob Nielsen, con rutas de archivo y las pruebas que lo respaldan. Todas las rutas son relativas a `frontend/` salvo que se indique otra cosa. Plan de trabajo: `src/modules/vuelos/docs/planes/2026-11-13-rediseno-frontend-nielsen.md`.

Alcance: el rediseño no cambia llamadas ni tipos de `src/api/` ni el backend. La parte de administración se rediseña en la Tanda 3 (en curso al escribir este documento): lo que se dice de ella es **lo planeado**, no lo verificado, y así se marca.

## Resumen: heurística → pantallas → evidencia

| # | Heurística | Pantallas principales | Evidencia en pruebas (`tests/unit/`) |
|---|---|---|---|
| H1 | Visibilidad del estado del sistema | Checkout (pasos, cuenta atrás), resultados (esqueletos), Banner de arranque del servidor, confirmación | `stepper.test.tsx`, `countdown.test.tsx`, `checkout-page.test.tsx`, `toast.test.tsx` |
| H2 | Relación entre el sistema y el mundo real | Búsqueda, tarjetas de vuelo (pase de abordar), checkout, errores | `labels.test.ts`, `money.test.ts`, `dates.test.ts`, `boarding-pass.test.tsx`, `problem-details.test.ts` |
| H3 | Control y libertad del usuario | Checkout (volver, salir), diálogos, cambiar de fecha en resultados | `confirm-dialog.test.tsx`, `dialog.test.tsx`, `checkout-page.test.tsx`, `stepper.test.tsx` |
| H4 | Consistencia y estándares | Todo el sitio (tokens, componentes `ui/`), encabezado y pie | `tabs.test.tsx`, `theme.test.tsx`, `boarding-pass.test.tsx`, `labels.test.ts` |
| H5 | Prevención de errores | Búsqueda, pasajeros, facturación, asientos, pago | `passenger-schema.test.ts`, `passenger-rules.test.ts`, `registration.test.ts`, `passenger-selector.test.tsx`, `seats.test.ts`, `airport-picker.test.tsx` |
| H6 | Reconocer en vez de recordar | Búsqueda (lista de aeropuertos), checkout (resumen siempre visible), precarga | `airport-picker.test.tsx`, `home-search.test.tsx`, `checkout-steps.test.tsx`, `best-value.test.ts` |
| H7 | Flexibilidad y eficiencia | Rutas frecuentes, tira de fechas, precarga del perfil, «Usar datos del pasajero 1», teclado | `home-search.test.tsx`, `checkout-steps.test.tsx`, `tabs.test.tsx`, `flight-card.test.tsx` |
| H8 | Diseño estético y minimalista | Resultados, checkout, confirmación | `flight-card.test.tsx`, `boarding-pass.test.tsx`, `confirmation-page.test.tsx` |
| H9 | Ayudar a reconocer y recuperarse de errores | Todas las pantallas con `ProblemAlert`, formularios, guard de admin | `problem-alert.test.tsx`, `problem-details.test.ts`, `problem-details-age.test.ts`, `checkout-steps.test.tsx`, `experience-reservation.test.tsx`, `admin-guard.test.tsx` |
| H10 | Ayuda y documentación | `/ayuda`, enlaces «¿Necesitas ayuda?», verificación de billete | (sin prueba propia de `HelpPage`; ver limitaciones) `admin-guard.test.tsx` para el aviso del guard |

Verificación global de la entrega: `npm run lint`, `npx tsc --noEmit`, `npm test` y `npm run build` en 0 errores (ver «Cómo se verificó»).

## H1. Visibilidad del estado del sistema

**Qué dice:** el sistema debe informar siempre de lo que está pasando, con una respuesta razonable y a tiempo.

**Cómo la cumple:**
- **Pasos de la compra.** `src/components/ui/Stepper.tsx` marca el paso actual con `aria-current="step"` y anuncia «Paso N de M: nombre» en una región `polite`. `src/features/checkout/CheckoutPage.tsx` mueve además el foco al título del paso al cambiar (`headingRef`). Prueba: `stepper.test.tsx`.
- **Reloj del cupo.** `src/components/common/Countdown.tsx` muestra «Tu reserva expira en: mm:ss» en el resumen (escritorio) y en la barra fija inferior (móvil). Por debajo de 6 minutos pasa a tono de aviso; por debajo de 2 minutos cambia el icono y añade el texto «Quedan menos de 2 minutos» (no solo color). Para lectores de pantalla solo se anuncia en los umbrales de 5 minutos, 1 minuto y 0, nunca cada segundo. Prueba: `countdown.test.tsx`.
- **Cargas.** `src/features/results/ResultsPage.tsx` usa esqueletos con `role="status"` y `aria-busy`, y un texto distinto al crear la oferta: «Preparando tu reserva. Estamos apartando tus asientos.». `CheckoutPage.tsx` muestra esqueletos mientras carga la oferta. Los botones de envío tienen estado de carga (`Button` con `isLoading`).
- **Servidor dormido.** `src/components/common/WakeUpBanner.tsx` avisa «Estamos conectando con el servidor. La primera vez puede tardar un poco; no cierres la página.» con una barra de progreso decorativa, cuando la primera petición tarda.
- **Resultados de una acción.** `src/components/ui/Toast.tsx` + `src/lib/toast.ts`: confirmaciones breves («Código copiado» en `features/confirmation/ConfirmationPage.tsx`, preferencias en `features/account/ProfilePage.tsx`, experiencias, vincular un viaje). Región `aria-live` educada para éxito y asertiva para errores. Prueba: `toast.test.tsx`.
- **Precio vigente.** Si el precio cambia antes de cobrar, `features/checkout/PriceChangedModal.tsx` muestra el valor anterior y el nuevo y no cobra hasta aceptar.

**Admin (planeado, Tanda 3):** toasts de éxito en todas las acciones y la hora de Ecuador con su etiqueta en todas las tablas.

## H2. Relación entre el sistema y el mundo real

**Qué dice:** hablar el idioma del usuario, con palabras y conceptos que le son familiares, no con términos del sistema.

**Cómo la cumple:**
- Todo el texto visible está en español; los códigos de la API nunca se muestran tal cual: `src/api/problem-details.ts` traduce cada `code` a una frase y cada campo inválido a una etiqueta («Fecha de nacimiento», «Número de documento»). Pruebas: `problem-details.test.ts`, `problem-details-age.test.ts`.
- Etiquetas de estado y tipos de pasajero en lenguaje del viajero (`src/lib/labels.ts`: `orderStatusLabel`, `passengerTypeLabel`, `fareFamilyLabel`). Prueba: `labels.test.ts`.
- «Pasajero 1 · Adulto» en lugar de identificadores internos (`features/checkout/PassengerForm.tsx`).
- Dinero con formato local y moneda explícita («Precios en dólares (USD)» en el checkout) mediante `src/components/common/MoneyText.tsx` y `src/lib/money.ts`; fechas y horas en hora de Ecuador con `src/lib/labels.ts` y `src/lib/dates.ts`. Pruebas: `money.test.ts`, `dates.test.ts`.
- La tarjeta de vuelo usa la metáfora del **pase de abordar** (`src/components/ui/BoardingPass.tsx`): códigos de aeropuerto grandes, hora debajo, duración en la línea de ruta y un talón con el precio. Prueba: `boarding-pass.test.tsx`.
- Aviso honesto de pago de prueba: «Pago de prueba: no se cobra ni se guardan los datos de tu tarjeta.» (`features/experiences/CardFieldset.tsx`).

**Admin (planeado):** textos en español («Id de solicitud», «Quién lo hizo», «Resumen») en lugar de «Correlation id» o «Dashboard».

## H3. Control y libertad del usuario

**Qué dice:** el usuario necesita una «salida de emergencia» clara para deshacer o salir de un estado no deseado.

**Cómo la cumple:**
- **Salir del checkout con cupo retenido.** «Volver a resultados» (`CheckoutPage.tsx`) lleva a la búsqueda original (`resultsPathFromOffer`) y, si hay un cupo apartado, pide confirmación con `ConfirmDialog`: «¿Salir de la compra?», con «Seguir comprando» como acción segura y la hora hasta la que sigue retenido. Prueba: `checkout-page.test.tsx`.
- **Volver a pasos anteriores.** El `Stepper` admite clic solo en pasos ya completados (`onStepClick`); cada formulario tiene «Atrás» (`features/checkout/StepActions.tsx`). Prueba: `stepper.test.tsx`.
- **Diálogos que se pueden cerrar.** `src/components/ui/Dialog.tsx`: Escape, botón cerrar, clic fuera (salvo los que exigen decisión, como el cambio de precio), devolución del foco al elemento que lo abrió y atrapa-foco. `src/components/ui/ConfirmDialog.tsx` deja el foco inicial en «Cancelar». Pruebas: `dialog.test.tsx`, `confirm-dialog.test.tsx`.
- **Cupo vencido.** En lugar de una pantalla rota, `EmptyState` «Se acabó el tiempo de tu reserva» con «Repetir la búsqueda» y la aclaración de que no hubo cobro.
- **Cambio de fecha sin volver a buscar.** `features/results/DateStrip.tsx` y `DateNavigator.tsx` cambian el día desde los resultados.

**Admin (planeado):** `ConfirmDialog` único para acciones destructivas, reprogramar un vuelo con confirmación que indica cuántas reservas se afectan, y menú de acciones por fila con «Cancelar» separado de «Eliminar».

## H4. Consistencia y estándares

**Qué dice:** las mismas palabras, situaciones y acciones deben significar lo mismo en todo el producto; seguir las convenciones de la plataforma.

**Cómo la cumple:**
- **Un único sistema de diseño.** Tokens como variables CSS en `src/styles/index.css` (claro y oscuro) expuestos por `tailwind.config.js` (`ink`, `muted`, `gold`, `gold-text`, `paper`, `surface`, `line`, `line-strong`, `success`, `danger`, `warning` y sus `-soft`, `chrome`). Una sola tipografía (Instrument Sans, autoalojada) y una escala de 1,25.
- **Componentes compartidos** en `src/components/ui/`: `Button` (un solo botón dorado de compra por pantalla), `Input`, `Select`, `FormField`, `Card`, `Badge`, `Dialog`, `ConfirmDialog`, `Tabs`, `Table`, `Stepper`, `Toast`, `EmptyState`, `PageHeader`. Pruebas: `tabs.test.tsx`, `stepper.test.tsx`, `confirm-dialog.test.tsx`, `toast.test.tsx`.
- **Un radio por jerarquía** (8 px controles, 12 px paneles, 16 px el pase) y sombra solo en elementos elevados.
- **Estados con el mismo vocabulario visual.** Las etiquetas de estado de órdenes, experiencias, auditoría y salud de proveedores usan los mismos tokens `success/warning/danger` (`src/lib/labels.ts`, `experiencias.ts`, `auditoria.ts`, `proveedores.ts`), siempre con texto.
- **Convenciones de la plataforma:** enlaces para navegar y botones para acciones, enlace «Saltar al contenido» en `components/layout/Header.tsx`, navegación `aria-label="Principal"`, selector de tema con tres botones (`ThemeToggle`, prueba `theme.test.tsx`).
- Mismo nombre para la misma acción: «Buscar vuelos» (único nombre de la búsqueda), «Reintentar» en todos los errores, «Volver a resultados».

**Admin (planeado):** la misma biblioteca (`Table`, `ConfirmDialog`, toasts, `PageHeader`) y navegación en 4 grupos (Ventas, Operación, Finanzas, Sistema) con las rutas `/admin/...` intactas.

## H5. Prevención de errores

**Qué dice:** mejor que un buen mensaje de error es un diseño que evita que el error ocurra.

**Cómo la cumple:**
- **Validación antes del envío**, con esquemas Zod: `features/checkout/passenger-schema.ts` (documento, vencimiento, correo, teléfono), `features/account/registration-schema.ts`. La regla de edad por tipo de pasajero se aplica en pantalla con `src/lib/passenger-rules.ts` igual que en el backend. Pruebas: `passenger-schema.test.ts`, `passenger-rules.test.ts`, `registration.test.ts`.
- **Los formularios usan `noValidate`** (búsqueda, login, registro, pasajeros, facturación, pago, recuperar orden, experiencias) para mostrar errores propios en línea, con el foco en el primer campo inválido (`features/search/SearchBar.tsx`), en vez de los globos del navegador.
- **Controles que impiden estados imposibles.** `features/search/PassengerSelector.tsx` limita personas y bebés por adulto (prueba `passenger-selector.test.tsx`); `AirportPicker.tsx` fuerza elegir un aeropuerto de la lista (prueba `airport-picker.test.tsx`); el mapa de asientos solo deja elegir asientos libres y los apartados por otros se muestran distintos (`features/checkout/SeatMap.tsx`, `src/lib/seats.ts`, prueba `seats.test.ts`).
- **Botón deshabilitado con motivo visible.** `features/checkout/StepActions.tsx` muestra al lado la razón («reason») y la enlaza con `aria-describedby`.
- **Confirmación antes de perder algo:** salir del checkout con cupo retenido (H3).
- **Doble envío evitado** con el estado de carga de los botones y con `Idempotency-Key` en las compras (cliente en `src/api/`).
- **Precio verificado antes de cobrar** (`PriceChangedModal.tsx`, H1).

## H6. Reconocer en vez de recordar

**Qué dice:** minimizar la carga de memoria; hacer visibles las opciones y la información necesaria.

**Cómo la cumple:**
- **Aeropuertos por nombre de ciudad** con lista desplegable, sin pedir recordar códigos (`features/search/AirportPicker.tsx`; todo el catálogo de Ecuador al abrir sin texto). Pruebas: `airport-picker.test.tsx`, `home-search.test.tsx`.
- **Resumen de la compra siempre a la vista** (`features/checkout/CheckoutSummary.tsx`): vuelo, pasajeros, total y reloj, a la derecha en escritorio y en barra fija en móvil.
- **Lo ya escrito se reutiliza:** el primer pasajero se precarga desde el perfil y la facturación ofrece «Usar datos del pasajero 1».
- **Tarifas comparables a la vista** (`features/fares/FareComparisonModal.tsx`, `FareFamilyCard.tsx`) con el badge calculado «Más conveniente» (`src/lib/best-value.ts`, prueba `best-value.test.ts`); el total del grupo aparece en la tarjeta de vuelo (`features/results/FlightCard.tsx`).
- **Búsqueda conservada:** la fecha, ruta y pasajeros de la búsqueda quedan visibles en los resultados y se recuperan al volver.
- Etiquetas siempre visibles (no solo placeholders) mediante `FormField`.

## H7. Flexibilidad y eficiencia de uso

**Qué dice:** aceleradores para usuarios expertos sin estorbar a los novatos.

**Cómo la cumple:**
- **Atajos de búsqueda:** rutas frecuentes en `features/search/HomePage.tsx`; tira de fechas cercanas con su precio mínimo (`DateStrip.tsx`) para comparar días sin buscar de nuevo.
- **Menos escritura:** precarga desde el perfil, «Usar datos del pasajero 1», cuenta con correo ya conocido en `PassengerForm.tsx`. Prueba: `checkout-steps.test.tsx`.
- **Teclado completo:** `Tabs` con flechas, Inicio y Fin (`tabs.test.tsx`); diálogos con Escape; todo operable con Tab y Enter; enlace «Saltar al contenido».
- **Gestión sin cuenta:** `features/orders/RetrieveOrderPage.tsx` permite recuperar una orden con número y apellido; con cuenta, «Mis viajes» (`features/account/OrderHistoryPage.tsx`) y vincular un viaje (`AddTripForm.tsx`).
- **Preferencias persistentes:** tema claro/oscuro/sistema guardado (`src/lib/theme.ts`, prueba `theme.test.tsx`).

**Admin (planeado):** filtros plegables, tablas con cabecera fija y menú de acciones por fila.

## H8. Diseño estético y minimalista

**Qué dice:** no mostrar información irrelevante; cada unidad extra compite con la importante.

**Cómo la cumple:**
- **Una acción principal por pantalla**, en dorado; el resto en tinta, contorno o texto.
- **Jerarquía del pase de abordar:** en cada resultado se ve lo esencial (origen, destino, horas, duración, precio y «Elegir») y lo secundario (aerolínea, vuelo, escalas) va en una línea de detalles más discreta (`BoardingPass.tsx`, `FlightCard.tsx`). Pruebas: `boarding-pass.test.tsx`, `flight-card.test.tsx`.
- **Sin decoración gratuita:** sin degradados ni animaciones de entrada; sombra solo en diálogos, toasts y menús; superficies planas.
- **Jerga fuera de la vista del viajero:** sin identificadores internos, sin «E.164» ni «NIT», sin lenguaje de prototipo (solo se mantiene el aviso legal de pago simulado).
- **Confirmación con lo necesario:** PNR, vuelos, pasajeros con su QR y siguientes pasos (`features/confirmation/ConfirmationPage.tsx`, prueba `confirmation-page.test.tsx`).
- Líneas de texto de hasta ~72 caracteres en páginas de lectura (`LegalLayout`).

## H9. Ayudar a reconocer, diagnosticar y recuperarse de los errores

**Qué dice:** los mensajes de error deben estar en lenguaje claro, indicar el problema con precisión y sugerir una solución.

**Cómo la cumple:**
- **`ProblemAlert`** (`src/components/common/ProblemAlert.tsx`): `role="alert"`, mueve el foco a sí mismo al aparecer, lista los campos inválidos con su etiqueta y motivo, ofrece «Reintentar» y el código de soporte como texto seleccionable más un botón «Copiar código para soporte». Un texto de error desconocido jamás llega a pantalla.
- **Error de red distinto del error del servidor.** Si el navegador no recibe respuesta (`SERVICE_UNAVAILABLE` sin id de correlación, `src/lib/network-error.ts`), el aviso dice «No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.» con «Reintentar». Pruebas: `problem-alert.test.tsx`, `experience-reservation.test.tsx`.
- **Mensajes por código** en español que dicen qué pasó y cómo seguir (`src/api/problem-details.ts`): «Tu sesión terminó. Inicia sesión nuevamente para continuar.», «Este correo ya tiene una cuenta. Inicia sesión.». Pruebas: `problem-details.test.ts`, `problem-details-age.test.ts`.
- **Errores en línea** junto al campo, enlazados con `aria-describedby`/`aria-invalid` mediante `FormField` y `src/lib/field-a11y.ts`. Prueba: `checkout-steps.test.tsx`.
- **Recuperación sin perder el trabajo:** reintento de la carga de condiciones legales dentro del paso de pago; oferta vencida con «Repetir la búsqueda»; precio cambiado con decisión explícita.
- **Pantalla de último recurso:** `components/common/ErrorBoundary.tsx` («Algo salió mal» con «Volver al inicio») y `routes/NotFoundPage.tsx` en lugar de una pantalla en blanco.
- **Acceso denegado explicado:** `routes/guards.tsx` (`AdminOnlyNotice`) dice «Esta sección es solo para administradores», por qué y ofrece volver o entrar con otra cuenta. Prueba: `admin-guard.test.tsx`.

## H10. Ayuda y documentación

**Qué dice:** aunque lo mejor es que no haga falta, puede ser necesaria ayuda breve, fácil de buscar y orientada a tareas.

**Cómo la cumple:**
- **Página de Ayuda por tareas** (`features/legal/HelpPage.tsx`, `/ayuda`): Buscar un vuelo, Reservar y pagar, Cambiar o cancelar, Recuperar una reserva, Verificar un billete, Mi cuenta y Contacto, con preguntas frecuentes y anclas (`/ayuda#recuperar`, `#cuenta`, `#contacto`).
- **Ayuda en contexto:** enlaces «¿Necesitas ayuda?» en `features/orders/RetrieveOrderPage.tsx`, `features/account/LoginPage.tsx`, `ProfilePage.tsx` y `VerifyEmailPage.tsx`, que llevan a la sección correspondiente.
- **Información legal clara** con versión y fecha (`features/legal/LegalLayout.tsx`: Transparencia, Condiciones de transporte, Términos, Privacidad) y aviso de pago simulado.
- **Verificación pública de billetes** (`features/verify/VerifyTicketPage.tsx`) que explica en lenguaje llano si un billete es auténtico.
- `FormField` admite un texto de apoyo (`hint`) junto a cada campo; su uso en pantallas concretas no se inventarió para este documento.

## Accesibilidad

### Contraste (WCAG 2.1 AA)
Medido con `node scripts/contrast.mjs` (lee los tokens de `src/styles/index.css`; mínimo 4,5:1 para texto y 3:1 para foco, iconos y bordes de control). Resultado de la ejecución del 13 de noviembre de 2026: **todos los pares pasan** (46 de 46).

| Par (primer plano / fondo) | Claro | Oscuro | Mínimo |
|---|---|---|---|
| ink / paper | 17,86 | 16,63 | 4,5 |
| ink / surface | 19,32 | 15,02 | 4,5 |
| muted / paper | 6,63 | 7,59 | 4,5 |
| muted / surface | 7,17 | 6,86 | 4,5 |
| gold-text / paper | 5,20 | 10,88 | 4,5 |
| gold-text / surface | 5,62 | 9,82 | 4,5 |
| gold-text / gold-soft | 4,90 | 8,67 | 4,5 |
| ink / gold-soft | 16,85 | 13,25 | 4,5 |
| on-ink / ink (botón primario) | 19,32 | 16,63 | 4,5 |
| on-gold / gold (botón de compra) | 6,37 | 9,00 | 4,5 |
| on-danger / danger (botón de peligro) | 6,57 | 6,97 | 4,5 |
| success / success-soft | 4,74 | 7,04 | 4,5 |
| danger / danger-soft | 5,75 | 5,97 | 4,5 |
| warning / warning-soft | 4,64 | 6,83 | 4,5 |
| success / surface | 5,32 | 7,87 | 4,5 |
| danger / surface | 6,57 | 6,30 | 4,5 |
| danger / paper | 6,08 | 6,97 | 4,5 |
| warning / surface | 5,19 | 8,09 | 4,5 |
| gold-text / paper (foco, icono) | 5,20 | 10,88 | 3 |
| gold-text / surface (foco) | 5,62 | 9,82 | 3 |
| line-strong / surface (borde de control) | 3,57 | 3,29 | 3 |
| line-strong / paper (borde de control) | 3,30 | 3,65 | 3 |
| gold / chrome (dorado sobre superficie de marca) | 6,37 | 7,42 | 4,5 |

El dorado de marca `#AB9159` solo sobre papel da unos 2,9:1, por eso **no se usa como texto**: para texto y foco va `gold-text`, más oscuro en claro y más claro en oscuro. Esto es una verificación de los tokens; no se auditó cada combinación real de cada pantalla con una herramienta externa (ver limitaciones).

### Foco visible
Estilo global de `:focus-visible` con `gold-text` en `src/styles/index.css`, con contraste ≥ 3:1 en claro y oscuro. Los diálogos atrapan el foco y lo devuelven; el checkout y `ErrorBoundary` mueven el foco al título nuevo; `ProblemAlert` toma el foco al aparecer. Pruebas: `dialog.test.tsx`, `confirm-dialog.test.tsx`, `stepper.test.tsx`, `problem-alert.test.tsx`.

### Teclado
Todo es alcanzable con Tab; enlace «Saltar al contenido» en `Header.tsx`; `Tabs` con flechas/Inicio/Fin; Escape cierra diálogos; las áreas de scroll de `Table` son enfocables; objetivos táctiles de al menos 44 px en acciones de errores y navegación móvil.

### Lectores de pantalla
Regiones vivas para estado (`Stepper`, `Countdown`, `Toast`, `ProblemAlert`, esqueletos con `aria-busy`); nombres accesibles explícitos (mapa de asientos: «Asiento 12A, libre…», QR del billete con el nombre del pasajero, `aria-label` en la navegación); campos con `aria-invalid`, `aria-required` y `aria-describedby`; iconos decorativos con `aria-hidden`. El estado nunca depende solo del color: siempre hay icono y texto (cuenta atrás, estados de orden, errores).

### Movimiento reducido
`@media (prefers-reduced-motion: reduce)` en `src/styles/index.css` elimina transiciones y animaciones; el cambio de paso del checkout hace scroll sin suavizado si el usuario lo prefiere; los toasts no animan en ese caso.

### Modo oscuro
Tres opciones (claro, oscuro, según el sistema) en `components/ui/ThemeToggle.tsx` y `src/lib/theme.ts`, guardadas en `localStorage` con `try/catch`, aplicadas por un script en `index.html` antes de pintar para evitar el parpadeo. Los tokens oscuros se midieron en la tabla anterior. La impresión (billetes, facturas) siempre sale en claro. El código QR mantiene fondo blanco puro en ambos modos para que siga siendo legible. Prueba: `theme.test.tsx`.

## Cómo se verificó
En `frontend/`: `npm run lint`, `npx tsc --noEmit`, `npm test` (Vitest + Testing Library; 55 archivos de prueba) y `npm run build`. El contraste con `node scripts/contrast.mjs`. Las pruebas del admin dependen del rediseño de la Tanda 3, que avanza en paralelo; si alguna cambia de texto, se actualiza sin borrarla.

## Limitaciones conocidas
Se listan sin maquillar:

- **Los datos del checkout se pierden al volver a un paso anterior.** Cada paso (`PassengerForm`, `BillingForm`, `ConditionsForm`) se desmonta al cambiar y su estado de `react-hook-form` no se conserva: al regresar, hay que volver a escribir lo que no se había enviado al servidor (los datos ya enviados sí quedan en la oferta). Es la principal deuda de H3/H6.
- **No hay enlace «¿Necesitas ayuda?» dentro del checkout** (solo en recuperar orden y cuenta). La Ayuda explica «Reservar y pagar», pero no se enlaza desde esos pasos.
- **No hay prueba automática de `HelpPage`**; su cobertura es manual.
- **El contraste es de los tokens, no de cada pantalla.** No se pasó un auditor automático (axe, Lighthouse) sobre las pantallas, ni se probó con lector de pantalla real (NVDA, VoiceOver); las afirmaciones de lectores se basan en roles y atributos verificados en pruebas de unidad.
- **No se revisó visualmente en navegador** el pase de abordar, el menú móvil y el modo oscuro en todas las pantallas durante la Tanda 1; se debe recorrer en escritorio y 375 px, en claro y oscuro.
- **Pruebas sin navegador real:** son pruebas de componentes en jsdom; no cubren layout, foco real del navegador ni impresión.
- **La búsqueda solo ofrece vuelos directos y cabina económica** (simplificación del backend, documentada).
- **El pago es simulado:** el aviso es explícito, pero la heurística H2 se cumple con una pasarela de prueba, no con una real.
- **El admin aún no cumple todo lo descrito:** la navegación en 4 grupos, los `ConfirmDialog` unificados, los toasts, el menú de acciones y el lenguaje claro son el trabajo de la Tanda 3. Hasta que termine, algunas páginas siguen con el puente de compatibilidad de estilos (`slate-*`, `bg-white`, `brand-*`) de `tailwind.config.js`; su retiro está registrado como tarea en el plan.
- **Algunas claves de color fuera de los tokens** (por ejemplo `sky-*`) pueden seguir existiendo en pantallas del admin y no se miden en modo oscuro.
- **Mensajes de error** dependen de que el backend envíe un `code` conocido; un código nuevo cae en un mensaje genérico hasta añadirlo a `problem-details.ts`.
