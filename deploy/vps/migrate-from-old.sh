#!/usr/bin/env bash
# Перенос базы и файлов со старого (домашнего) сервера на этот. Запускать на НОВОМ сервере из deploy/vps.
# Старое приложение лучше остановить заранее, чтобы данные не менялись во время переноса.
#
#   OLD=server@СТАРЫЙ_АДРЕС ./migrate-from-old.sh
#
# Параметры старого сервера (если отличаются от значений по умолчанию):
#   OLD_PG_CONTAINER=postgres  OLD_PG_USER=postgres  OLD_PG_DB=crm  OLD_VOLUME=deploy_crm_storage
set -euo pipefail
: "${OLD:?укажите OLD=пользователь@адрес старого сервера}"
OLD_PG_CONTAINER="${OLD_PG_CONTAINER:-postgres}"
OLD_PG_USER="${OLD_PG_USER:-postgres}"
OLD_PG_DB="${OLD_PG_DB:-crm}"
OLD_VOLUME="${OLD_VOLUME:-deploy_crm_storage}"
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "→ поднимаю PostgreSQL"
docker compose up -d postgres
until docker compose exec -T postgres pg_isready -U crm_app -d crm >/dev/null 2>&1; do sleep 2; done

echo "→ переношу базу $OLD_PG_DB"
ssh "$OLD" "docker exec $OLD_PG_CONTAINER pg_dump -U $OLD_PG_USER -Fc --no-owner --no-privileges $OLD_PG_DB" \
  | docker compose exec -T postgres pg_restore -U crm_app -d crm --no-owner --no-privileges --clean --if-exists

echo "→ переношу файлы клиентов (том $OLD_VOLUME)"
docker volume create firmspace_crm_storage >/dev/null
ssh "$OLD" "docker run --rm -v $OLD_VOLUME:/data alpine:3 tar czf - -C /data ." \
  | docker run --rm -i -v firmspace_crm_storage:/data alpine:3 tar xzf - -C /data

echo "→ запускаю приложение и Caddy"
docker compose up -d --build
sleep 20
docker compose exec -T crm node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)"
echo "Готово. Проверьте вход и данные, затем переключите DNS."
