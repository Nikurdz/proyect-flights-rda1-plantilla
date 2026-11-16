# dto — contratos de entrada y salida del núcleo (v1)

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `search.dto.ts` | Búsqueda y respuestas de ofertas |
| `hold.dto.ts` | Crear/leer holds (incluye `assignedSeats`) |
| `booking.dto.ts` | Reservas, pasajeros, tickets |
| `postventa.dto.ts` | Equipaje, cambio de fecha, cancelación, check-in |
| `webhooks.dto.ts` | Suscripciones a webhooks |
| `flight-status.dto.ts` | Estado de vuelo |
| `problem-details.dto.ts` | Forma de `application/problem+json` |
| `enums.ts` | Enums del contrato |
| `validators.ts` | Validadores propios (class-validator) |

## Cómo se conecta

- Los usan `../vuelos.controller.ts` y `../services/`. Los DTO de la API v2 están aparte en `../v2/dto-v2.ts`; los del e-commerce, dentro de cada subdominio.
- Siguen `contracts/vuelos-openapi.yaml`; añadir campos opcionales está bien, cambiar reglas de v1 no.

## Más a fondo

- [Servicios](../services/README.md) · [Contratos](../../../../contracts/README.md)

← Volver a [vuelos](../README.md)
