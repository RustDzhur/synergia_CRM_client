#!/usr/bin/env bash
# Безопасная накатка схемы БД перед запуском нового контейнера (вызывается из autodeploy.sh).
# Работает в образе стадии сборки (там есть prisma CLI и scripts/), в той же сети и с тем же .env, что и сайт.
# 1) scripts/reconcile-links.mjs — проверка дублей номеров документов (код 2 = стоп: уникальный индекс не лёг бы);
# 2) prisma db push --accept-data-loss: единственное предупреждение схемы — новые уникальные индексы (org, number), а дубли уже исключены шагом 1.
# Новая схема только добавляет колонки/таблицы/индексы, поэтому старый контейнер продолжает работать, пока выкладка стоит.
# Код выхода: 0 — схема актуальна; не 0 — выкладку не продолжать.
set -uo pipefail
cd "$(dirname "$0")/.."
LOG="${LOG:-${HOME:-/home/server}/crm-autodeploy.log}"
IMG="firmspace-crm-migrate:latest"
log() { printf '%s migrate: %s\n' "$(date -Is)" "$*" >> "$LOG"; }

docker build --target build -t "$IMG" . >> "$LOG" 2>&1 || { log "не удалось собрать образ миграции"; exit 1; }
RUN=(docker run --rm --env-file deploy/.env --network infrastructure "$IMG")

"${RUN[@]}" node scripts/reconcile-links.mjs >> "$LOG" 2>&1
case $? in
    0) ;;
    2) log "найдены дубли номеров документов — накатка схемы и выкладка остановлены, старая версия работает"; exit 2 ;;
    *) log "проверка связей не удалась — выкладка остановлена"; exit 1 ;;
esac

"${RUN[@]}" npx prisma db push --skip-generate --accept-data-loss >> "$LOG" 2>&1 || { log "prisma db push не прошёл — выкладка остановлена, старая версия работает"; exit 1; }
# Робот-офис: перенос роботов/поручений из SectionRecord в таблицы (идемпотентно; код 2 — перенос неполный, выкладка останавливается)
"${RUN[@]}" node scripts/migrate-office.mjs >> "$LOG" 2>&1 || { log "перенос Робот-офиса не удался — выкладка остановлена, старая версия работает"; exit 1; }
# Повторный прогон на новой схеме: отчёт об осиротевших ссылках (только чтение)
"${RUN[@]}" node scripts/reconcile-links.mjs >> "$LOG" 2>&1 || true
log "схема актуальна"
