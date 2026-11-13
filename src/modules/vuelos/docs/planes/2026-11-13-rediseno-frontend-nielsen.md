# Plan de implementación: rediseño moderno del frontend y navegación simple (heurísticas de Nielsen)

- **Fecha:** 2026-11-13
- **Agente:** Claude Code Desktop (programador, con el skill `frontend-design:frontend-design`)
- **Área:** frontend
- **Rama:** `vuelos`

## Objetivo
Modernizar la apariencia del frontend (`frontend/`), simplificar la navegación y cumplir las 10 heurísticas de Nielsen sin romper la conexión con el backend (mismos endpoints y datos). Estilo premium limpio con la misma marca (negro #0B0E14 y dorado #AB9159), para cliente y admin, con modo oscuro (claro / oscuro / según el sistema).

## Alcance
- Incluye: sistema de diseño (tokens, tipografía, tema, componentes base, Header/Footer) en la **Tanda 1**; las tandas 2 a 4 quedan descritas abajo como hoja de ruta.
- No incluye: backend (`src/` de la raíz), llamadas y tipos de `frontend/src/api`, nuevas rutas, captura real de tarjetas (el pago sigue simulado).
- Única dependencia nueva: `@fontsource-variable/instrument-sans`.

## Contexto y referencias
Auditoría de los agentes `explorador`: buena base (stepper de compra, errores en español, foco en diálogos, estados vacíos con días alternativos). Problemas: dos paletas duplicadas (`brand.*` y `airline.*`), sin toasts, el cambio de paso del checkout no mueve el foco ni se anuncia, «Volver a resultados» pierde la búsqueda, mensajes contradictorios del pago simulado, jerga visible (ADT-1, E.164, NIT, IATA), 10 pestañas planas en el admin, reprogramar vuelo sin confirmación, formularios con globos del navegador (sin `noValidate`), textos en inglés.

### Dirección de diseño
**Tema, público y tarea:** aerolínea RAM Alliance; viajeros de Ecuador que compran un vuelo y un equipo interno que opera ventas y vuelos. La tarea del sitio es encontrar y comprar un vuelo sin dudas; la del admin, resolver un caso rápido.

**Paleta** (la marca fija negro y dorado; el resto se eligió por contraste AA, con papel frío en vez de crema cálido):

| Token (Tailwind) | Claro | Oscuro | Uso |
|---|---|---|---|
| `ink` | `#0B0E14` | `#ECEEF2` | texto principal, botón primario |
| `on-ink` | `#FFFFFF` | `#0B0E14` | texto sobre fondo `ink` |
| `muted` | `#4F5868` | `#9AA3B2` | texto secundario |
| `gold` | `#AB9159` | `#C9AE72` | relleno de acento (botón de compra). No para texto |
| `gold-text` | `#7A6532` | `#D8C08A` | dorado como texto, icono y foco |
| `gold-soft` | `#F4EFE4` | `#2A2418` | fondo dorado suave |
| `on-gold` | `#0B0E14` | `#0B0E14` | texto sobre `gold` |
| `paper` | `#F5F6F8` | `#0B0E14` | fondo de página |
| `surface` | `#FFFFFF` | `#151A23` | tarjetas y paneles |
| `line` | `#E3E5EA` | `#262C38` | divisores y bordes decorativos |
| `line-strong` | `#808896` | `#626C7E` | borde de controles (>= 3:1) |
| `chrome` | `#0B0E14` | `#1B2230` | superficie de marca siempre oscura (texto blanco) |
| `success` / `success-soft` | `#1F7A4D` / `#E8F5EE` | `#4CC38A` / `#12281D` | éxito |
| `danger` / `danger-soft` / `on-danger` | `#B42318` / `#FDECEA` / `#FFF` | `#F2766B` / `#33161A` / `#0B0E14` | error y acción destructiva |
| `warning` / `warning-soft` | `#A15C07` / `#FDF1DC` | `#E8A33D` / `#33260F` | aviso |

(Las variables CSS viven en `frontend/src/styles/index.css`, como tripletes `R G B` para admitir opacidad: `bg-ink/5`.) Los estados se muestran siempre con icono y texto, nunca solo con color.

**Tipografía:** una sola familia, **Instrument Sans** (variable, autoalojada con `font-display: swap`, sin Google Fonts). Cifras tabulares con la utilidad `.num` (horas, precios, PNR). Escala 1,25 en el theme: `text-small` 14, `text-body` 16, `text-lead` 20, `text-title` 25, `text-heading` 31, `text-display` 39, `text-hero` 49 (los `text-xs/sm/base/lg` de Tailwind siguen para las páginas aún sin rediseñar). Pesos 400, 500 y 600; sin mayúsculas en etiquetas; líneas de hasta 72 caracteres.

**Lo memorable (único gesto audaz):** el **pase de abordar** (`BoardingPass`): códigos IATA grandes con la hora debajo, línea de ruta con la duración, talón separado por una perforación con precio, PNR o botón. En móvil el talón pasa abajo. Todo lo demás queda sobrio: superficies planas, un radio por jerarquía (8 px controles `rounded-lg`, 12 px paneles `rounded-xl`, 16 px pase `rounded-2xl`), sombra solo en elementos elevados (diálogos, toasts, `Card elevated`), sin degradados decorativos ni animaciones de entrada por sección.

**Layout** (alineado a la izquierda; centrado solo en estados vacíos y confirmación):

```
Inicio                               Resultados
┌ logo  Buscar vuelos  Mis viajes  ┐ ┌ ruta y fecha  [Modificar] ───────┐
│       Experiencias  Ayuda  ◐  👤 │ │ ‹ lun 17 · mar 18 · mié 19 › tira │
├──────────────────────────────────┤ ├──────────────────────────────────┤
│ ¿A dónde viajas?                 │ │ ┌ UIO 07:00 ──50 min── GYE 07:50 ┊ $86 ┐
│ [Origen][Destino][Fechas][Pax]   │ │ └ RAM · RA2500 · directo         ┊ Elegir┘
│ [Buscar vuelos]                  │ │  (pase de abordar, talón con precio)
│ rutas frecuentes (atajos)        │ └──────────────────────────────────┘
└──────────────────────────────────┘
Checkout                              Admin
┌ ① Pasajeros ② Facturación ③ ... ┐  ┌ Ventas    │ Resumen               │
│ formulario         │ pase resumen│  │  Órdenes  │ [filtros plegables]   │
│                    │ total + reloj│  │  Mostrador│ tabla responsive      │
└ móvil: barra fija con total y cuenta atrás ┘  │ Operación │ ...           │
                                                │ Finanzas  │               │
                                                │ Sistema   │               │
```

**Principios:** 1) la búsqueda es el héroe; 2) una acción principal por pantalla, en dorado; 3) el estado siempre a la vista (paso, reloj del cupo, guardado); 4) palabras del viajero, no del sistema; 5) errores que dicen qué pasó y cómo seguir.

**Revisión frente a lo genérico:** se descartó el kit de tarjetas SaaS idénticas con sombra gris (el radio grande y la perforación son solo del pase), el héroe de «número grande + degradado», las etiquetas en mayúsculas y los «→» en botones. La única concesión a un rasgo común es el negro de marca, que fija la marca.

## Cambios previstos (Tanda 1 — hecha)
| Archivo / módulo | Cambio |
|------------------|--------|
| `frontend/src/styles/index.css` | Variables CSS de tokens (`:root` claro, `.dark` oscuro), foco visible con `gold-text`, `prefers-reduced-motion`, utilidad `.num`, impresión siempre en claro |
| `frontend/tailwind.config.js` | `darkMode: 'class'`, colores semánticos con `<alpha-value>`, `brand.*` como alias, `airline.*` eliminado, escala tipográfica, sombras |
| `frontend/index.html`, `src/main.tsx` | Sin Google Fonts; Instrument Sans autoalojada; script inline que aplica el tema antes de pintar |
| `src/lib/theme.ts`, `components/common/ThemeProvider.tsx`, `components/ui/ThemeToggle.tsx` | Tema claro/oscuro/sistema, persistido en `localStorage` (`ram-theme`, con try/catch) |
| `src/lib/toast.ts`, `components/ui/Toast.tsx` | `ToastProvider` + `useToast`, instalado en `App.tsx` |
| `components/ui/{Button,Input,Select,FormField,Card,Badge,Dialog,Skeleton}.tsx` | Renovados con los tokens |
| `components/ui/{Tabs,Table,EmptyState,PageHeader,Stepper,ConfirmDialog,BoardingPass}.tsx` | Nuevos (ConfirmDialog movido; `features/admin/ConfirmDialog.tsx` es un re-export) |
| `components/layout/{Header,Footer}.tsx` | Navegación del viajero, menú móvil, selector de tema |
| 60+ archivos de `src/features`, `components/common`, `routes` | Reemplazo mecánico de `airline-*` y de `bg-brand-black` por tokens (ver «Mapeo») |
| `frontend/scripts/contrast.mjs` | Verificación de contraste AA leyendo `index.css` |
| `frontend/tests/unit/*` | Pruebas nuevas (toast, theme, tabs, stepper, confirm-dialog, boarding-pass); `dialog.test.tsx` reescrito por comportamiento |

### Mapeo de los alias (para las tandas 2 y 3)
- `airline-sand` -> `paper`; `airline-navy` -> `ink` (si lleva `text-white`: `bg-ink text-on-ink`); `airline-blue` -> `gold-text` (borde/foco/texto) o `bg-ink text-on-ink` (relleno); `airline-blue-light` -> `gold-soft`; `airline-gold` -> `gold`.
- `bg-brand-black` -> `bg-chrome` (superficie siempre oscura con texto blanco, para que no se invierta en modo oscuro). `text-brand-black` sigue valiendo (= `ink`).
- `brand.*` y `slate-*` siguen existiendo como **puente transitorio**: `slate-*` se invierte en modo oscuro y `bg-white` equivale a `surface`, para que las páginas aún sin rediseñar sigan legibles. **No usar `slate-*`, `bg-white` ni `brand-*` en código nuevo**; al rediseñar cada página se sustituyen por `ink`, `muted`, `surface`, `line`, etc.

### API de los componentes nuevos (`frontend/src/components/ui`)
- `Toast`: `<ToastProvider>` una vez en la raíz; `const toast = useToast()` (de `lib/toast`) -> `toast.success|error|info|warning(titulo, descripcion?)`, `toast.show({title, description?, tone?, duration?})`, `toast.dismiss(id)`. Región `aria-live="polite"` (éxito/info/aviso) y `assertive` (errores); se oculta a los 5 s (8 s los errores; `duration: 0` = fijo; se pausa con el puntero o el foco); máx. 4; sin animación si `prefers-reduced-motion`.
- `Tabs`: `tabs: {id, label, panel, disabled?}[]`, `ariaLabel` (obligatorio), `value?`/`onValueChange?` (controlado) o `defaultValue?`; flechas, Home, End, tabindex móvil.
- `Table` (+ `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, `TableCell`): `label` (obligatorio), `maxHeightClass?` (por defecto `max-h-[70vh]`), `wrapperClassName?`; envoltura con scroll accesible por teclado y cabecera sticky. Cifras: `className="num text-right"`.
- `EmptyState`: `title`, `description?`, `icon?`, `action?`, `headingLevel?`.
- `PageHeader`: `title` (único h1), `description?`, `breadcrumbs?: {label, to?}[]`, `actions?`.
- `Stepper`: `steps: {id, label, description?}[]`, `current` (índice), `onStepClick?` (solo pasos completados), `ariaLabel?`; `aria-current="step"` y región `polite` «Paso N de M: nombre». La página debe además mover el foco al título del paso.
- `ConfirmDialog`: `isOpen, title, children, confirmLabel, cancelLabel?, destructive?, isLoading?, error?, errorMessage?, onConfirm, onClose` (igual que antes; el foco inicial queda en «Cancelar»).
- `BoardingPass`: `origin`/`destination` = `{code, time, city?, date?}`, `duration`, `details?`, `stub?` (talón: precio, PNR, botón), `ariaLabel?`, `notchClassName?` (color del fondo de la página, por defecto `bg-paper`, para las muescas de la perforación), `className?`. Sin uso todavía en páginas.
- `Button`: `variant` primary (tinta) | accent (dorado, una acción de compra por pantalla) | secondary | outline | ghost | danger; `size` sm|md|lg; `isLoading`.
- `Badge`: `variant`, `size`, `icon?`. `Card`: `elevated?`, `hoverable?`. `FormField`: `label, hint?, error?, required?, children: (control) => ReactNode` (entrega `id`, `aria-invalid`, `aria-describedby`, `aria-required`); `Input`/`Select` conservan su API.
- `ThemeToggle` (grupo de tres botones con `aria-pressed`) y `useTheme()` (`lib/theme`) -> `{mode, resolved, setMode}`.

## Impacto en la API / contrato
Ninguno.

## Pasos
1. Tanda 1: sistema de diseño (esta entrega).
2. Tanda 2 — Cliente (dos agentes en paralelo: búsqueda/resultados/cuenta y checkout/confirmación/experiencias). Búsqueda: placeholder por ciudad, quitar chip falso «Cabina Economy», un solo nombre «Buscar vuelos», ayuda de pasajeros. Resultados: `BoardingPass` con el precio en el talón, total del grupo, «Válida hasta» en hora de Ecuador, badge «Más conveniente», esqueleto «Preparando tu reserva». Checkout: `Stepper` con foco y anuncio, cuenta atrás visible en móvil, «Volver a resultados» conserva la búsqueda y confirma si hay cupo retenido, textos de pago coherentes («Pago de prueba, no se cobra»), «Pasajero 1 · Adulto», sin E.164/NIT, precarga desde el perfil, estado vacío si la oferta no carga. Cuenta: `noValidate` + errores en línea, ayuda de verificación, mensaje en el guard de admin. Experiencias: `MoneyText`, toasts de éxito. Quitar el lenguaje de «prototipo» (se mantiene el aviso legal del pago simulado).
3. Tanda 3 — Admin: `AdminLayout` con 4 grupos (Ventas, Operación, Finanzas, Sistema), rutas `/admin/...` intactas; vuelos con confirmación de reprogramación y sin estado preseleccionado; `ConfirmDialog` y toasts en todas las páginas; `Table` responsive; textos en español; hora de Ecuador con su etiqueta.
4. Tanda 4 — Ayuda y verificación: página de Ayuda por flujo, enlaces «¿Necesitas ayuda?», checklist de heurísticas en `docs/RDA2-docs/HEURISTICAS-NIELSEN.md`.

## Riesgos y decisiones abiertas
- El puente `slate-*` / `bg-white` / `brand-*` evita que el modo oscuro deje ilegibles las páginas viejas, pero no las deja pulidas: cada página debe migrar a los tokens en su tanda y, al terminar, retirar el puente de `tailwind.config.js`.
- Las muescas de la perforación del `BoardingPass` imitan el fondo con `notchClassName`; si el pase está sobre una superficie que no es `paper`, hay que pasar su clase.
- No se pudo revisar visualmente (sin navegador en el entorno de la Tanda 1): el pase, el menú móvil y el modo oscuro quedan por revisar en el navegador en la Tanda 2.
- «Mis experiencias» sale del grupo de la derecha y pasa a la navegación principal solo con sesión de cliente.

## Verificación
Resultados de la Tanda 1 (en `frontend/`):
- `npm run lint`: 0 errores y 0 avisos. `npx tsc --noEmit`: 0 errores. `npm test`: 46 archivos, 297 pruebas, todas pasan (incluye las 6 suites nuevas). `npm run build`: correcto.
- Dev server de Vite: arranca sin errores y sirve el HTML (con el script de tema, sin enlaces a Google Fonts), `main.tsx` y el CSS (HTTP 200). No se capturó la consola del navegador ni capturas de pantalla.

### Contraste AA medido (`node scripts/contrast.mjs`, lee `src/styles/index.css`)
Mínimo 4,5:1 para texto y 3:1 para foco, iconos y bordes de control. Todos los pares pasan.

| Par (primer plano / fondo) | Claro | Oscuro |
|---|---|---|
| ink / paper | 17,86 | 16,63 |
| ink / surface | 19,32 | 15,02 |
| muted / paper | 6,63 | 7,59 |
| muted / surface | 7,17 | 6,86 |
| gold-text / paper | 5,20 | 10,88 |
| gold-text / surface | 5,62 | 9,82 |
| gold-text / gold-soft | 4,90 | 8,67 |
| ink / gold-soft | 16,85 | 13,25 |
| on-ink / ink (botón primario) | 19,32 | 16,63 |
| on-gold / gold (botón de compra) | 6,37 | 9,00 |
| on-danger / danger (botón peligro) | 6,57 | 6,97 |
| success / success-soft | 4,74 | 7,04 |
| danger / danger-soft | 5,75 | 5,97 |
| warning / warning-soft | 4,64 | 6,83 |
| success / surface | 5,32 | 7,87 |
| danger / surface | 6,57 | 6,30 |
| danger / paper | 6,08 | 6,97 |
| warning / surface | 5,19 | 8,09 |
| gold-text / paper (foco, no texto) | 5,20 | 10,88 |
| line-strong / surface (borde de control) | 3,57 | 3,29 |
| line-strong / paper (borde de control) | 3,30 | 3,65 |
| gold / chrome (dorado sobre superficie de marca) | 6,37 | 7,42 |

Nota: `gold` solo (`#AB9159`) sobre papel da unos 2,9:1, por eso no se usa como texto: para texto va `gold-text`.

## Componentes comunes y páginas restantes (fuera del admin) — hecho
- `components/common` (`Countdown`, `ProblemAlert`, `WakeUpBanner`, `ErrorBoundary`, `TicketQr`), `features/legal/LegalLayout`, `features/results/DateStrip`, `routes/NotFoundPage` y las clases de estado de `lib/{labels,auditoria,experiencias,proveedores}.ts` pasaron a los tokens (`success|warning|danger` y `-soft`, `ink`, `muted`, `line`, `surface`, `gold-soft`, `gold-text`).
- `ProblemAlert` (H9): un fallo de red sin respuesta (`SERVICE_UNAVAILABLE` sin id de correlación, `lib/network-error.ts`) muestra «No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.» con «Reintentar»; el código de soporte se ve como texto pequeño seleccionable además del botón de copiar.
- `Countdown`: aviso por debajo de 6 min (tokens `warning`) y estado urgente por debajo de 2 min con icono y el texto «Quedan menos de 2 minutos» (`data-state`), no solo color.
- `TicketQr`: el fondo del QR es blanco puro (`bg-[#ffffff]`): `bg-white` es el token `surface` y en modo oscuro dejaba el QR ilegible.
- Pruebas nuevas: `tests/unit/problem-alert.test.tsx`, `tests/unit/countdown.test.tsx`; `experience-reservation.test.tsx` actualizado al texto de red.

## Tarea pendiente: retirar el puente de `tailwind.config.js`
Cuando termine el rediseño del admin: quitar de `frontend/tailwind.config.js` el objeto `slate`, el alias `brand.*` y `backgroundColor.white`, y sus variables `slate-*` de `src/styles/index.css`; después `npm run build` y revisar el admin en claro y oscuro.
Archivos que aún usan el puente (grep `slate-|brand-|bg-white`, a fecha 2026-11-13). Fuera del admin ya no queda ninguno (el único `bg-white` restante es `print:bg-white` en `ConfirmationPage.tsx`, que sigue valiendo con el puente retirado). Pendientes, todos en `frontend/src/features/admin/`:
`AdminAirportsPage.tsx`, `AdminAuditPage.tsx`, `AdminBookingBillingPage.tsx`, `AdminDashboardPage.tsx`, `AdminInvoicesPage.tsx`, `AdminNodesHealthPage.tsx`, `AdminObservabilityPage.tsx`, `AdminProvidersPage.tsx`, `AdminReservationsPage.tsx`, `AdminWebhooksPage.tsx`, `BillingTabs.tsx`, `LatencyChart.tsx`, `LedStatus.tsx`, `TraceFlowGraph.tsx`, `dashboard/charts.tsx`.
(El otro agente puede estar migrando algunos ahora: volver a ejecutar el grep antes de retirar.)
