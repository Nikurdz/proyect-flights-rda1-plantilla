# ecommerce/identidad/ — Cuentas, sesión (JWT propio) e invitados

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `identidad.controller.ts` | Rutas de auth y clientes |
| `identidad.service.ts` | Registro, login, bloqueo, invitado, preferencias, roles; emite los JWT |
| `password.util.ts` | Hash y verificación de contraseñas |
| `dto/identidad.dto.ts` | Entradas validadas |
| `entities/cliente.entity.ts` | `ecom_clientes` |
| `entities/cliente-rol.entity.ts` | `ecom_cliente_roles` y `ecom_roles` |
| `identidad.module.ts` | Módulo Nest |

## Endpoints (`/api/v1`)
`POST auth/login` · `POST auth/invitado` · `POST auth/verificar-correo` · `POST clientes` (registro) · `GET clientes/:id` · `PUT clientes/:id/preferencias`.

## Eventos
Publica `ClienteRegistrado`, `ConsentimientoActualizado`, `CuentaBloqueada`.

## Cómo se conecta
Los tokens (HS256) los verifica [../../auth/](../../auth/README.md); `ownerId` = `sub` (o `guest:<id>`). Los roles viven en el JWT: un cambio aplica en el siguiente login. Los gestiona [../admin/](../admin/README.md); notifica [../notificaciones/](../notificaciones/README.md).

## Cuaderno y auditorías
Semana 11 (seguridad): [cuaderno](../../docs/RDA2-docs/auditorias/RETO-2-CUADERNO/README.md).

## Más a fondo
[ecommerce](../README.md) · [módulo vuelos](../../README.md)

← Volver a [../README.md](../README.md)
