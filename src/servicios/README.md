# src/servicios — satélites por microservicio (solo demo local)

Tres procesos pequeños que corren un dominio cada uno, alimentados por RabbitMQ. **Producción no los usa**: Azure corre una sola imagen.

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `auditoria/` | `main.ts` (puerto **3001**) + `auditoria.module.ts`: consume todos los eventos hacia `auditoria_transacciones` y purga por retención |
| `notificaciones/` | `main.ts` (puerto **3002**) + `notificaciones.module.ts`: convierte eventos en mensajes (`ecom_notificaciones`) |
| `webhooks/` | `main.ts` (puerto **3003**) + `webhooks.module.ts`: encola entregas de webhooks, alimenta `vuelos_outbox`, corre el despachador |
| `comun/satelite.ts` | `arrancarSatelite`, `SateliteBaseModule`, `infraSatelite` (sin `synchronize`) y `alFallar` |
| `comun/health.controller.ts` | `GET /health` (sin prefijo, sin base ni broker): `{status:"UP", servicio}` |

## Cómo se conecta

- `SERVICE_ROLE` (`api`, `auditoria`, `notificaciones`, `webhooks`; vacío = monolito) lo lee `modules/vuelos/common/service-role.ts`; el satélite lo fuerza y falla si choca.
- Cada uno escucha su cola propia vía `RABBITMQ_SERVICE_QUEUE` (`q.svc.<servicio>`), implementada en `modules/vuelos/esb/rabbitmq.transport.ts`. `PORT` cambia el puerto.
- Se levantan con `docker-compose.microservicios.yml` y `docker/<servicio>/Dockerfile`.

## Más a fondo

- [Contenedores por microservicio](../modules/vuelos/docs/RDA2-docs/CONTENEDORES-POR-MICROSERVICIO.md)
- [ESB y RabbitMQ](../modules/vuelos/esb/README.md) · [docker/](../../docker/README.md)

← Volver a [src/README.md](../README.md)
