# Despliegue de la versión normalizada (Fases 1–4)

Pasos para llevar esta versión a producción (Railway + Neon + Netlify). La migración de base de datos **no tiene vuelta atrás**: sin copia previa no se aplica.

## 0. Lo que se probó antes de escribir esto
- La cadena `migrate → seed → start` (`npm run start:render`) contra una base vacía con `NODE_ENV=production`: arranca, `/health` en UP y la introspección de GraphQL queda bloqueada.
- La migración `NormalizeSchema` sobre bases con el esquema anterior y datos reales (siete muestras generadas por el código anterior y una copia de la base de desarrollo): todas migran y `migration:check` queda sin diferencias.
- Un detalle que solo apareció con datos reales: una regla de desistimiento con una familia tarifaria que no existe (mercado antiguo). La migración ya la omite. **Ensaya siempre en una copia de la base de producción antes de migrar la real.**

## Base de datos y cuotas (Neon agotado)
Neon Free apaga el cómputo tras 5 minutos sin consultas, pero las tareas de fondo antiguas lo mantenían despierto y el cupo mensual se agotó. Esta versión las detiene cuando nadie usa el sistema (`APP_IDLE_MS`) y trae `GET /api/v1/health/live`, que no toca la base: **apunta ahí el health check de Railway y cualquier monitor**.

Si Neon sigue bloqueado, una opción gratuita y siempre encendida es **Aiven PostgreSQL (plan gratuito)**: crea el servicio, copia la *Service URI* (con `sslmode=require`) y úsala como `DATABASE_URL` (opcional: `DB_SSL_CA` con el certificado de Aiven para verificar el servidor). Límites: 1 GB y 20 conexiones (el pool usa 5 por defecto, `DB_POOL_MAX`). Una base nueva se llena sola con `start:render` (migra y siembra); el administrador sale de `ADMIN_EMAIL`/`ADMIN_PASSWORD`, y `DATA_ENCRYPTION_KEY` puede ser nueva porque no hay datos cifrados que conservar.

## 1. Antes de desplegar
1. **Copia de seguridad de Neon** (rama de Neon o `pg_dump`), y guarda el archivo fuera del repositorio.
2. **Ensayo en una copia**: restaura la copia en una base desechable y, desde tu máquina, con `DATABASE_URL` apuntando a ella y la **misma** `DATA_ENCRYPTION_KEY` que usa producción:
   ```bash
   npm run migration:run:vuelos
   npm run migration:check:vuelos      # debe decir "No changes in database schema were found"
   ```
   Si falla, no sigas: el mensaje dice qué dato lo impide.
3. **Variables de Railway** (además de las que ya existen):
   - `DATA_ENCRYPTION_KEY` — obligatoria en producción y **la misma de siempre**: la migración descifra y vuelve a cifrar los datos personales con ella. Si cambia, los datos ya guardados quedan ilegibles.
   - `CORS_ORIGINS` con el origen de Netlify (cubre también `/graphql`).
   - Opcionales: `RABBITMQ_URL` (vacío = bus en proceso), `PROVEEDORES_*`, `HTTP_LOG_RETENTION_DAYS`, `LOG_TO_FILES=false` si no quieres archivos (el sistema de archivos de Railway es efímero). `PROVEEDORES_ALLOW_PRIVATE_HOSTS` **no** debe ponerse en producción: el servidor se niega a arrancar.
4. **Netlify**: `VITE_API_URL` como hasta ahora; `VITE_GRAPHQL_URL` solo si el gateway no está en el mismo host que la API (se deriva de `VITE_API_URL`).

## 2. Desplegar
`npm run start:render` migra, siembra (idempotente: aeropuertos, aerolíneas, roles, plantillas) y arranca. Si la migración falla, el servicio no arranca y la base queda como estaba (la migración corre en una transacción).

## 3. Comprobar
- `GET /api/v1/health` con la base en `UP`.
- Iniciar sesión como administrador y revisar Órdenes y Facturación (cada orden ya emitida tiene su factura).
- `/admin/proveedores`: registrar el proveedor de Atracciones (URL con o sin `/api/v2`), 🔄 comprobar y 📥 sincronizar.

## 4. Si algo sale mal
Restaurar la copia de Neon y volver a desplegar la versión anterior. No hay `down` para `NormalizeSchema`.

## Nota sobre el estado actual
Cuando se escribió este documento, el despliegue vigente en Railway era el anterior a estas fases y su `/health` respondía con la base de datos en `DOWN`: conviene revisar el proyecto de Neon (suspendido, sin cuota o credencial cambiada) antes de migrar.
