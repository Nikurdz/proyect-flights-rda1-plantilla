# Plan de implementación: corrección de la auditoría de frontend 2026-10-06

- **Fecha:** 2026-10-07
- **Agente:** Antigravity
- **Área:** frontend
- **Rama:** `vuelos`

## Objetivo
Cerrar los hallazgos de `AUDITORIA-10-6-2026-Frontend.md` (4 críticos, 6 altos, 8 medios, 6 bajos) de accesibilidad y responsive, sin tocar backend ni la marca RAM Alliance más de lo necesario.

## Alcance
- Incluye: C1–C4, A1–A6, M1–M8, B2–B6 en `frontend/src`.
- No incluye: backend, pagos reales con tarjeta, `role="grid"` con flechas en `SeatMap` (mejora opcional), `npm run lint`.

## Contexto y referencias
`AUDITORIA-10-6-2026-Frontend.md` §2–§5. Patrón de referencia: `features/checkout/PaymentForm.tsx` (labels, `aria-invalid`, `aria-describedby`, `role="alert"`).

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `components/ui/Dialog.tsx`, `features/fares/FareComparisonModal.tsx` | C2: trampa de foco, foco inicial/retorno, Escape, `type="button"`, `max-h` + scroll; migrar `FareComparisonModal` a `Dialog` |
| `PassengerForm.tsx`, `BillingForm.tsx`, `SearchBar.tsx`, `ui/Input.tsx`, `ui/Select.tsx` | C3/A2: `id`+`htmlFor`, `aria-invalid`, `aria-describedby`, errores `role="alert"`; `label` obligatorio |
| `features/search/AirportPicker.tsx`, `PassengerSelector.tsx` | C1: combobox ARIA completo; Escape y `aria-live` en conteos |
| `routes/index.tsx`, `RouteEffects.tsx`, `ErrorBoundary.tsx`, `LoginPage`, `RegisterPage`, `ProblemAlert` | C4/M8/B6: foco a `main`/`h1` al navegar, foco en alert/status, primer campo inválido, título por ruta |
| `SearchBar`, `DateStrip`, `DateNavigator`, `CheckoutStepper`, `SortingBar` | A1/A6: `aria-pressed`, `aria-current="step"`, `aria-live`, `aria-label` en prev/next |
| `tailwind.config.js`, `Button`, `Badge`, `Footer`, `ProblemAlert` | A3: contrastes ≥4.5:1 vía tokens |
| `Button`, `Header`, `Dialog`, `LoginPage`, `RegisterPage`, `ProblemAlert` | A4/M6: objetivos ≥44 px, `type="button"` por defecto, iconos `aria-hidden`, `aria-busy` |
| `AdminOrdersPage`, `AdminFlightsPage`, `AdminObservabilityPage`, `PrivacyPage`, `TransparencyPage` | A5: wrapper `role="region" tabindex="0" aria-label`, `caption`, `scope="col"`; legales con `overflow-x-auto` |
| `Countdown`, `RetrieveOrderPage`, `SeatSelector`, `PriceChangedModal`, `LegalLayout`, `CardBrandLogo`, `AdminLayout`, `TicketQr`, `Skeleton`, `Header`, `Card` | M1–M5, M7, B2–B5 |

## Impacto en la API / contrato
Ninguno.

## Pasos
1. F-1: `Dialog` primero, luego C3, C1, C4. Commit.
2. F-2: A1–A6. Commit.
3. F-3: medios y bajos. Commit.
4. Si B-1 del backend cambia el seatmap (A2), verificar que `SEAT_TAKEN` se sigue manejando igual.
5. Pruebas §5 de la auditoría y addendum con resultados.

## Riesgos y decisiones abiertas
- Cambios de color (A3) pueden alejarse de la identidad de marca: ajustar solo tokens y validar con el usuario.
- Migrar `FareComparisonModal` a `Dialog` puede alterar su estilo.
- Sin ESLint: verificación con axe/pa11y y revisión manual.

## Verificación
`cd frontend && npm run build`; flujo búsqueda→compra→verificación solo con teclado; axe-core/pa11y sin violaciones críticas; matriz 320/390/768/escritorio sin overflow horizontal; consola sin errores; revisión con lector de pantalla en modales, checkout y combobox. Terminado = 0 críticos y 0 altos abiertos.
