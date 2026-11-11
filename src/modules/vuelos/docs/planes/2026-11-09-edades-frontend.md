# Entrega para Antigravity: validaciones de edad en los pasajeros

- **Fecha:** 2026-11-09
- **De:** Claude Code Desktop (backend) **a:** Antigravity (frontend)
- **Rama:** `vuelos`

Hay que validar las edades en el frontend en todo el «check-in» de pasajeros. El cliente no tiene una pantalla de check-in: es el formulario de datos de pasajeros `features/checkout/PassengerForm.tsx`. El mostrador de administración no tiene fechas de nacimiento y no cambia.

## Reglas (fuente de verdad: `src/modules/vuelos/common/business-rules.ts`)
- Bandas por edad cumplida a la fecha del vuelo: **INFANT 0-1, CHILD 2-11, YOUTH 12-17, ADULT 18-120**. Etiquetas: `passengerTypeLabel` (`lib/labels.ts`).
- La edad se calcula a la fecha **UTC** de `oferta.trayectos[0].salida` (`new Date(salida).toISOString().slice(0, 10)`), con los campos UTC de `birth` y `reference` exactamente como `ageAt`: años enteros, restando 1 si el cumpleaños aún no ocurrió; un cumpleaños el mismo día de la referencia ya cuenta.
- **Nuevo en el backend:** el tipo declarado también debe corresponder a la edad en el **último** vuelo (un bebé que cumple 2 años antes de la vuelta deja de ser infante → 422 «el tipo cambia antes del último vuelo»); una fecha de nacimiento **futura** se rechaza; y ambos errores traen el campo (`invalidParams`: `pasajeros.fechaNacimiento`).
- Infantes ≤ adultos; cada infante va con un adulto distinto y un adulto lleva como mucho un infante (`asociadoA`); máximo 9 pasajeros por orden (`MAX_PASSENGERS_PER_ORDER`).
- Documento: la cédula (`NATIONAL_ID` con nacionalidad `EC`) debe ser real (módulo 10: 10 dígitos, provincia 01-24 o 30, tercer dígito < 6, dígito verificador; ver `isValidEcuadorCedula` en `common/business-rules.ts`). El vencimiento del documento es obligatorio si algún tramo cruza una frontera (países distintos, o aeropuerto desconocido) y debe ser **posterior** a la fecha UTC del último vuelo. No se repiten el número de documento (sin signos, en mayúsculas) ni nombre + fecha de nacimiento.
- «Hoy» y los límites de los campos de fecha son el **día de Ecuador** (`getTodayDateString()`, `lib/dates.ts`).

## Cambios pedidos
1. **`frontend/src/lib/passenger-rules.ts`** (nuevo): bandas, `ageAtDate`, tipo esperado por edad, mensajes en español por tipo («Niño: 2 a 11 años el día del primer vuelo»), fecha de calendario válida, no futura, ≤ 120 años, `isValidEcuadorCedula`, vencimiento posterior al último vuelo.
2. **`PassengerForm.tsx`**: esquema zod con el contexto de la oferta (`superRefine` o fábrica): edad coherente con el tipo en el primer **y** el último vuelo, fecha de nacimiento válida, no futura y ≤ 120 años, cédula válida, vencimiento (obligatorio si es internacional; países por el catálogo `GET /localidades`, que devuelve todos los aeropuertos con `pais`; aeropuerto desconocido = internacional) posterior al último vuelo, sin documentos ni personas repetidos, un adulto distinto por infante. Atributos `min`/`max` en las fechas y, bajo la fecha de nacimiento, el rango permitido del tipo. El label del vencimiento deja de decir «(opcional)» cuando es obligatorio.
3. **Jóvenes (12-17):** en `features/search/PassengerSelector.tsx` un contador «Joven (12 a 17 años)» y el texto de Adulto «Desde 18 años»; el máximo (9) sale de una constante (no repetido en el texto); `lib/search.ts` lleva `yth` en la URL; `ResultsPage.tsx` envía `jovenes`; los jóvenes cuentan para el máximo y **no** para el tope de infantes. En `PassengerForm.tsx` crear filas `YTH-n` desde `oferta.pasajeros.jovenes` (hoy no se lee).
4. **Errores del servidor:** el 422 de edad ya trae `invalidParams` (`pasajeros.fechaNacimiento`); comprobar que `api/problem-details.ts` marca el campo.
5. De paso, `account/RegisterPage.tsx` y `registration-schema.ts` deben usar el día de Ecuador (`max` de la fecha de nacimiento y `ageOn`).

## Pruebas
`tests/unit/passenger-rules.test.ts` (límites 1/2, 11/12, 17/18, cumpleaños el día de referencia, futura, 120 años, cédula, vencimiento), el esquema del formulario, y `PassengerSelector` (jóvenes, infantes ≤ adultos, máximo); patrones de `registration.test.ts`, `dates.test.ts` y `admin-reservations-page.test.tsx`. `npm run lint`, `npx tsc --noEmit`, `npm run build` y `npm test` en `frontend/` en 0 errores.
