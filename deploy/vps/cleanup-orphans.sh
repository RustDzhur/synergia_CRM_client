#!/usr/bin/env bash
# Убирает «осиротевшие» контейнеры compose-проекта: если пересоздание контейнера оборвалось (сбой сборки, перезагрузка ВМ), Docker
# оставляет старый под именем вида 4fe46a6ebc3c_firmspace-crm, и следующий `up` падает с «Conflict. The container name … is already in use».
# Удаляются только контейнеры этого проекта (метка com.docker.compose.project) с именем «<12 hex>_<имя>». Данные лежат в томах — они не затрагиваются.
set -uo pipefail
PROJECT="${COMPOSE_PROJECT_NAME:-firmspace}"
docker ps -a --filter "label=com.docker.compose.project=$PROJECT" --format '{{.ID}} {{.Names}}' |
while read -r id name; do
    if [[ "$name" =~ ^[0-9a-f]{12}_ ]]; then
        echo "удаляю осиротевший контейнер $name"
        docker rm -f "$id" >/dev/null 2>&1 || echo "не удалось удалить $name"
    fi
done
