#!/usr/bin/env bash
# Перенос базы и файлов на новый сервер, запуск на СТАРОМ (домашнем) сервере.
# Так надёжнее, чем тянуть с нового: у дома нет публичного IPv4, а у нового сервера он есть, и исходящее соединение
# из дома наружу работает всегда.
#
# Перед запуском на новом сервере: склонировать репозиторий, создать deploy/vps/.env, а на старом остановить приложение
# (docker stop firmspace-crm). Публичный SSH-ключ старого сервера добавить в ~/.ssh/authorized_keys нового.
#
#   NEW=user@НОВЫЙ_АДРЕС ./push-to-new.sh
#
# Параметры (если отличаются от значений по умолчанию):
#   OLD_PG_CONTAINER=postgres  OLD_PG_USER=postgres  OLD_PG_DB=crm  OLD_VOLUME=deploy_crm_storage
#   NEW_DIR=synergia_CRM_client/deploy/vps   (путь на новом сервере относительно домашнего каталога)
set -euo pipefail
: "${NEW:?укажите NEW=пользователь@адрес нового сервера}"
OLD_PG_CONTAINER="${OLD_PG_CONTAINER:-postgres}"
OLD_PG_USER="${OLD_PG_USER:-postgres}"
OLD_PG_DB="${OLD_PG_DB:-crm}"
OLD_VOLUME="${OLD_VOLUME:-deploy_crm_storage}"
NEW_DIR="${NEW_DIR:-synergia_CRM_client/deploy/vps}"

echo "→ поднимаю PostgreSQL на новом сервере"
ssh "$NEW" "cd $NEW_DIR && docker compose up -d postgres && until docker compose exec -T postgres pg_isready -U crm_app -d crm >/dev/null 2>&1; do sleep 2; done"

echo "→ переношу базу $OLD_PG_DB"
docker exec "$OLD_PG_CONTAINER" pg_dump -U "$OLD_PG_USER" -Fc --no-owner --no-privileges "$OLD_PG_DB" \
  | ssh "$NEW" "cd $NEW_DIR && docker compose exec -T postgres pg_restore -U crm_app -d crm --no-owner --no-privileges --clean --if-exists"

echo "→ переношу файлы клиентов (том $OLD_VOLUME)"
docker run --rm -v "$OLD_VOLUME":/data alpine:3 tar czf - -C /data . \
  | ssh "$NEW" "docker volume create firmspace_crm_storage >/dev/null && docker run --rm -i -v firmspace_crm_storage:/data alpine:3 tar xzf - -C /data"

echo "Готово. На новом сервере: cd $NEW_DIR && docker compose up -d --build"
