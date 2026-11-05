# Despliegue en Azure Container Apps (cuenta de estudiante, coste mínimo)

El backend corre como contenedor en **Azure Container Apps** (plan de consumo, sin Log Analytics). La base de datos sigue en Aiven y el frontend en Netlify.

- 0,25 vCPU / 0,5 GiB, **máximo 1 réplica** (los jobs, el debounce del stock y los límites viven en memoria: dos réplicas los duplicarían).
- **Escala a cero** por defecto (`MIN_REPLICAS=0`): coste casi nulo, pero mientras duerme no se envía stock a Booking ni corren la reconciliación y los webhooks, y la primera llamada espera el arranque (migración + seed + Nest, unos 15–30 s). Cada despertar vuelve a enviar todo el stock. Para tenerla siempre encendida: `MIN_REPLICAS=1 ./crear.sh` (≈ 3–10 USD/mes).
- La imagen se construye en GitHub Actions (`.github/workflows/container.yml`) y se publica en GitHub Container Registry. El despliegue a Azure lo haces tú con `az`, sin secretos de Azure en GitHub.

## Una sola vez

1. **Crédito:** portal.azure.com → Cost Management → Credits. Crea una alerta de presupuesto de ~5 USD.
2. **Azure CLI:** instálalo y ejecuta `az login`. Si tu cuenta limita regiones, prueba otra: `LOCATION=centralus ./crear.sh`.
3. **Imagen pública:** tras el primer push a `vuelos`, en GitHub → tu perfil/organización → Packages → `proyect-flights-rda1-plantilla` → Package settings → *Change visibility* → **Public** (así Azure la descarga sin credenciales). El nombre debe estar en minúsculas.
4. **Variables:** `cp .env.azure.example .env.azure` y copia los valores desde Railway. `DATA_ENCRYPTION_KEY` debe ser **idéntica** a la de Railway.
5. **Crear:**
   ```bash
   cd deploy/azure
   ./crear.sh
   ```
   Imprime la URL base v2, la del token y las IP salientes.
6. **Aiven:** si restringe por IP, permite las IP salientes que imprimió el script.
7. **Netlify:** pon `VITE_API_URL=https://<fqdn>/api/v1` y vuelve a desplegar el frontend; añade el origen de Netlify en `CORS_ORIGINS`.
8. **Booking:** avísales de la URL nueva (`https://<fqdn>/api/v2/vuelos` y `.../api/v2/oauth2/token`) y de que la primera llamada tras un reposo tarda unos segundos.
9. **Railway:** cuando todo responda, apágalo (dos servidores a la vez envían el mismo stock y duplican jobs).

## Cada versión nueva

Tras un push a `vuelos` y cuando el workflow *Container image* termine:

```bash
./desplegar.sh          # última imagen
./desplegar.sh <sha>    # una concreta
```

Si cambias variables, edita `.env.azure` y vuelve a ejecutar `./crear.sh` (actualiza la app).

## Verificar

```bash
curl https://<fqdn>/api/v1/health/live
curl https://<fqdn>/api/v2/vuelos/health
az containerapp logs show -g rg-ram-alliance -n vuelos-api --follow   # logs en vivo (no hay histórico)
```

En los logs debe salir `Stock push round: … sent`. Tras ~5 min sin tráfico la réplica baja a 0; una nueva llamada la despierta.

## Probar la imagen en local

```bash
docker build -t vuelos .
docker run --env-file .env -p 3000:3000 vuelos
```
