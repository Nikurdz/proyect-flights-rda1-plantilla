# frontend/src/components — piezas reutilizables (ui, common, layout)

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `ui/Button.tsx`, `ButtonLink.tsx`, `button-styles.ts` | Botón y enlace-botón; variantes compartidas |
| `ui/Input.tsx`, `Select.tsx`, `FormField.tsx` | Controles de formulario y etiqueta + error accesible |
| `ui/SuggestInput.tsx` | Campo con sugerencias en vivo |
| `ui/Card.tsx`, `Badge.tsx`, `PageHeader.tsx` | Tarjeta, etiqueta de estado, cabecera de página |
| `ui/Table.tsx`, `Tabs.tsx` | Tabla y pestañas |
| `ui/Dialog.tsx`, `ConfirmDialog.tsx` | Diálogo modal y de confirmación |
| `ui/Toast.tsx` | `ToastProvider` y avisos (se disparan con `lib/toast.ts`) |
| `ui/Stepper.tsx` | Pasos de la compra |
| `ui/BoardingPass.tsx` | Pase de abordar visual con QR |
| `ui/EmptyState.tsx`, `Skeleton.tsx` | Estado vacío y carga |
| `ui/Logo.tsx`, `CardBrandLogo.tsx` | Emblema RAM Alliance y marcas de tarjeta |
| `ui/ThemeToggle.tsx` | Claro / oscuro / sistema |
| `common/ThemeProvider.tsx` | Contexto del tema |
| `common/ErrorBoundary.tsx` | Captura errores de render |
| `common/ProblemAlert.tsx` | Muestra un `ProblemDetailsError` con código copiable |
| `common/WakeUpBanner.tsx` | Aviso «servidor despertando» |
| `common/Countdown.tsx` | Cuenta regresiva de la reserva (aviso < 6 min, urgente < 2 min) |
| `common/MoneyText.tsx`, `TicketQr.tsx` | Importe formateado y QR del billete |
| `layout/Header.tsx`, `Footer.tsx` | Cabecera (sesión, tema) y pie en columnas |

## Cómo se conecta

Usan solo tokens (`ink`, `gold`, `paper`, `surface`, `line`, `success|warning|danger`) de [styles/README.md](../styles/README.md). `Header`/`Footer` los monta `routes/index.tsx`. `features/admin/` tiene además `ConfirmDialog.tsx` propio.

## Cuaderno y auditorías

Evidencia por heurística (foco visible, estados, `data-state`): [HEURISTICAS-NIELSEN.md](../../../src/modules/vuelos/docs/RDA2-docs/HEURISTICAS-NIELSEN.md).

## Más a fondo

[Plan del rediseño](../../../src/modules/vuelos/docs/planes/2026-11-13-rediseno-frontend-nielsen.md) · [lib/README.md](../lib/README.md)

← Volver a [frontend/src/README.md](../README.md)
