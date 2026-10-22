# Plan de implementación: ESLint en el frontend y cierre de la auditoría de accesibilidad/responsive

- **Fecha:** 2026-10-11
- **Agente:** Antigravity
- **Área:** frontend
- **Rama:** `vuelos`

## Objetivo
Que `frontend/` tenga ESLint 9 (configuración plana) y `npm run lint` pase con 0 errores, y cerrar los hallazgos abiertos de `AUDITORIA-10-6-2026-Frontend.md` (C1–C4, A1–A6, M1–M8, B1–B6), verificando cada uno contra el código actual. Es la parte de frontend del plan general `2026-10-11-eslint-y-pendientes-auditoria.md`.

## Alcance
- Incluye: devDependencies `eslint@^9`, `@eslint/js`, `typescript-eslint`, `globals`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-jsx-a11y`; `frontend/eslint.config.js`; scripts `lint` y `lint:fix`; corrección de todos los errores; correcciones de accesibilidad y responsive de la auditoría; tests nuevos del combobox (teclado) y del `Dialog` (foco, Escape, retorno).
- No incluye: backend, entidades, migraciones, contrato OpenAPI, raíz del repositorio. Ningún endpoint nuevo. No se añade captura real de tarjeta.

## Contexto y referencias
- `src/modules/vuelos/docs/AUDITORIA-10-6-2026-Frontend.md` (4 críticos, 6 altos, 8 medios, 6 bajos).
- Patrón de referencia de formularios accesibles: `frontend/src/features/checkout/PaymentForm.tsx`.
- WCAG 2.2 AA: 1.3.1, 1.4.3 (contraste 4.5:1), 2.1.1 (teclado), 2.4.3 (orden de foco), 2.5.8 (tamaño de objetivo), 4.1.2 (nombre, rol, valor).

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `frontend/package.json`, `frontend/eslint.config.js` | ESLint 9 plano: `@eslint/js` + `typescript-eslint` recomendados, `react-hooks` recomendado, `react-refresh/only-export-components` (warn), `jsx-a11y` (strict si es viable). Ignora `dist/`, `node_modules/`, `coverage/`, `src/api/schema.d.ts`. Scripts `lint`, `lint:fix`. |
| `components/ui/Dialog.tsx` | Trampa de foco, foco inicial, retorno al disparador, `type="button"`, `max-h` + scroll, overlay sin `div onClick` accesible. |
| `features/fares/FareComparisonModal.tsx` | Migrado a `Dialog` (hereda Escape/foco). |
| `features/search/AirportPicker.tsx`, `PassengerSelector.tsx` | Combobox ARIA (flechas, Enter, Escape, `aria-activedescendant`, input etiquetado, error asociado con `role="alert"`); selector de pasajeros con Escape, etiqueta y conteos anunciados. |
| `features/checkout/PassengerForm.tsx`, `BillingForm.tsx`, `features/search/SearchBar.tsx` | `id` + `label htmlFor`, `aria-invalid`, `aria-describedby`, errores con `role="alert"`. |
| `routes/RouteEffects.tsx`, `routes/index.tsx` | Foco a `main#contenido` (`tabIndex={-1}`) al cambiar de ruta y título por ruta. |
| `components/ui/Button.tsx`, `Select.tsx`, `Badge.tsx`, `Input.tsx` | `type="button"` por defecto, `aria-busy`, spinner oculto, `aria-describedby` en `Select`, contraste, tamaños táctiles. |
| Resultados, checkout, legal, admin, layout | `aria-pressed`/`aria-current`, tablas en regiones focables con `th scope="col"`, iconos `aria-hidden`, `aria-label` en prev/next, Countdown sin anuncio por segundo, píldoras legales con `aria-current`. |
| `frontend/tests/unit/` | Tests nuevos: `airport-picker.test.tsx`, `dialog.test.tsx`; ajustes de tests existentes si cambia el marcado. |

## Impacto en la API / contrato
Ninguno. El frontend sigue consumiendo los mismos endpoints `api/v1`.

## Pasos
1. Instalar ESLint y plugins; crear configuración y scripts; ejecutar lint y corregir errores.
2. Verificar cada hallazgo de la auditoría en el código actual; corregir críticos y altos, después medios y bajos sencillos.
3. Añadir tests de combobox y `Dialog`; ajustar los existentes.
4. Ejecutar `npm run lint`, `npm run build`, `npm test`; comprobar conexión contra el backend local si está disponible.

## Riesgos y decisiones abiertas
- ESLint 10: se pidió `eslint@^10` + `@eslint/js@^10`, pero `eslint-plugin-jsx-a11y@6.10.2` (última versión) declara `eslint: ^3 || … || ^9` en sus peerDependencies (react-hooks 7.1.1, react-refresh 0.5.7 y typescript-eslint 8.71.1 sí aceptan 10). Se queda en `eslint@^9` / `@eslint/js@^9` hasta que jsx-a11y publique soporte.
- `jsx-a11y/no-noninteractive-tabindex` se configura para permitir `role="region"` (además de `tabpanel`): es el patrón de tabla desplazable focable que pide la auditoría (A5).
- `jsx-a11y` strict puede marcar patrones válidos (p. ej. `autoFocus` en diálogos); se usa strict y, si una regla no encaja, se documenta en la configuración.
- Cambios de token de color (`airline-blue`, `Badge secondary`) alteran ligeramente la marca visual; se oscurecen lo mínimo para llegar a 4.5:1.
- M3 (`SeatMap` como `role="grid"` con flechas) se considera mejora evolutiva; la auditoría lo califica de aceptable con Tab.

## Verificación
`cd frontend && npm run lint` (0 errores), `npm run build` y `npm test` en verde; tests nuevos de teclado/foco pasando; tabla con el estado de cada hallazgo en el informe de entrega.
