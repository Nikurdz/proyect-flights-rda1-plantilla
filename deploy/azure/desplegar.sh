#!/usr/bin/env bash
# Publica una version nueva (revision) usando una imagen ya construida por GitHub Actions.
#   ./desplegar.sh            -> :latest
#   ./desplegar.sh <sha>      -> la imagen de ese commit
set -euo pipefail
RG="${RG:-rg-ram-alliance}"
APP_NAME="${APP_NAME:-vuelos-api}"
REPO="${IMAGE_REPO:-ghcr.io/nikurdz/proyect-flights-rda1-plantilla}"
TAG="${1:-latest}"

az containerapp update -g "$RG" -n "$APP_NAME" --image "$REPO:$TAG" --only-show-errors -o none
echo "Desplegado $REPO:$TAG"
az containerapp revision list -g "$RG" -n "$APP_NAME" --query "[].{revision:name,activa:properties.active,estado:properties.runningState}" -o table
