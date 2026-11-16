# migrations — esquema de producción (TypeORM)

En producción no se sincroniza el esquema: lo crean estas migraciones. `data-source.ts` es el DataSource del CLI (y recoge las entidades por glob).

## Qué hay aquí (orden cronológico)

| Migración | Cambio |
|---|---|
| `1791167576852-InitVuelosSchema` | Esquema inicial |
| `1791254000000-EncryptPassengerPii` | Cifrado de datos personales de pasajeros |
| `1791340000000-AdminOrderIndex` · `1791430000000-ObservabilityIndexes` | Índices de back office y observabilidad |
| `1791520000000-PostSaleAndWebhooks` | Posventa y webhooks |
| `1791610000000-HoldLockedTaxes` | Impuestos fijados en el hold |
| `1792970623866-NormalizeSchema` | 3FN con FK reales (**sin vuelta atrás**; respalde antes) |
| `1792972360174-AddProveedores` | Proveedores externos |
| `1793059559095-ContractV2` | Contrato v2 (OAuth2, outbox…) |
| `1793932853618-PassengerTravellers` | Viajeros con índice ciego |
| `1794182400000-BookingRefundAmounts` | Montos de reembolso/penalidad |
| `1794268800000-TraceabilityColumns` | Trazabilidad unificada |
| `1794355200000-FlightHoldSeats` | Asientos apartados por el hold |
| `1794441600000-PerformanceIndexes` | Índices de rendimiento |

## Cómo correr y chequear

```bash
npm run migration:run:vuelos          # aplicar
npm run migration:generate:vuelos -- src/modules/vuelos/migrations/Nombre   # contra una BD con el esquema anterior
npm run migration:check:vuelos        # debe salir con 0 sobre una BD migrada
```

Sin default de columna tipo array (TypeORM lo ve como deriva). Pruebe contra datos del código anterior, no solo una BD vacía.

## Más a fondo

- [Despliegue y normalización](../docs/DESPLIEGUE-NORMALIZACION.md) · [Modelo de datos](../docs/MODELO-DE-DATOS.md) · [Entidades](../entities/README.md)

← Volver a [vuelos](../README.md)
