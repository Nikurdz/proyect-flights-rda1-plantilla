#!/usr/bin/env bash
# Crea (o actualiza) en Azure el grupo de recursos, el entorno de Container Apps y la app del backend.
# Requisitos: Azure CLI (`az login` hecho), Node, y deploy/azure/.env.azure relleno.
# Coste: entorno solo de consumo, sin Log Analytics, 0,25 vCPU / 0,5 GiB, maximo 1 replica.
#   MIN_REPLICAS=0 (por defecto) escala a cero; MIN_REPLICAS=1 la deja siempre encendida.
# Regiones que permite la suscripcion Azure for Students: westus, chilecentral, francecentral, spaincentral, brazilsouth.
set -euo pipefail
# Git Bash en Windows convertiria "/subscriptions/..." en una ruta de Windows al pasarlo a node/az.
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"
cd "$(dirname "$0")"

RG="${RG:-rg-ram-alliance}"
LOCATION="${LOCATION:-westus}"
ENV_NAME="${ENV_NAME:-cae-ram-alliance}"
APP_NAME="${APP_NAME:-vuelos-api}"
IMAGE="${IMAGE:-ghcr.io/nikurdz/proyect-flights-rda1-plantilla:latest}"

# `az ... -o tsv` termina cada linea con \r en Windows: se quita para no contaminar los valores.
clean() { tr -d '\r'; }

az extension add --name containerapp --upgrade --only-show-errors
az provider register --namespace Microsoft.App --only-show-errors
az provider register --namespace Microsoft.OperationalInsights --only-show-errors

az group create --name "$RG" --location "$LOCATION" --only-show-errors -o none

if ! az containerapp env show -g "$RG" -n "$ENV_NAME" -o none 2>/dev/null; then
  # --logs-destination none: sin Log Analytics (sin coste de logs). Los logs se ven en vivo.
  az containerapp env create -g "$RG" -n "$ENV_NAME" --location "$LOCATION" \
    --logs-destination none --enable-workload-profiles false --only-show-errors -o none
fi
ENV_ID="$(az containerapp env show -g "$RG" -n "$ENV_NAME" --query id -o tsv | clean)"

node generar-app.js "$IMAGE" "$LOCATION" "$ENV_ID" > .app.generada.json

if az containerapp show -g "$RG" -n "$APP_NAME" -o none 2>/dev/null; then
  az containerapp update -g "$RG" -n "$APP_NAME" --yaml .app.generada.json --only-show-errors -o none
else
  az containerapp create -g "$RG" -n "$APP_NAME" --yaml .app.generada.json --only-show-errors -o none
fi
rm -f .app.generada.json

FQDN="$(az containerapp show -g "$RG" -n "$APP_NAME" --query properties.configuration.ingress.fqdn -o tsv | clean)"
echo
echo "URL base v2 : https://$FQDN/api/v2/vuelos"
echo "Token OAuth2: https://$FQDN/api/v2/oauth2/token"
echo "Health      : https://$FQDN/api/v1/health/live"
echo "IP salientes (permitelas en Aiven si filtra por IP):"
az containerapp env show -g "$RG" -n "$ENV_NAME" --query properties.staticIp -o tsv | clean
az containerapp show -g "$RG" -n "$APP_NAME" --query properties.outboundIpAddresses -o tsv | clean
echo "Logs en vivo: az containerapp logs show -g $RG -n $APP_NAME --follow"
