#!/usr/bin/env bash
# Publica una version nueva (revision) usando una imagen ya construida por GitHub Actions.
#   ./desplegar.sh            -> la imagen del commit actual (HEAD), que publica el workflow como :<sha>
#   ./desplegar.sh <sha>      -> la imagen de ese commit
#   ./desplegar.sh latest     -> :latest (OJO: si ya estaba desplegada :latest, Azure no crea revision nueva)
# Esperar antes a que termine el workflow "Container image" de ese commit.
set -euo pipefail
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"
cd "$(dirname "$0")"

RG="${RG:-rg-ram-alliance}"
APP_NAME="${APP_NAME:-vuelos-api}"
REPO="${IMAGE_REPO:-ghcr.io/nikurdz/proyect-flights-rda1-plantilla}"
TAG="${1:-$(git rev-parse HEAD | tr -d '\r')}"

az containerapp update -g "$RG" -n "$APP_NAME" --image "$REPO:$TAG" --only-show-errors -o none
echo "Desplegado $REPO:$TAG"
az containerapp revision list -g "$RG" -n "$APP_NAME" --query "[].{revision:name,activa:properties.active,estado:properties.runningState}" -o table
