#!/usr/bin/env bash
# Ручная выкладка одной командой: убрать осиротевшие контейнеры, собрать и запустить. Запускать из любой папки:
#   ~/crm-duplicate/deploy/vps/up.sh
set -euo pipefail
cd "$(dirname "$0")"
./cleanup-orphans.sh
docker compose -f docker-compose.yml up -d --build --remove-orphans
