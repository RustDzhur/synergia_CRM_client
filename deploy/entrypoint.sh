#!/bin/sh
# Запуск контейнера: сначала досыпаем в базу недостающие таблицы и колонки (схема только дополняется), потом стартует сайт.
# Это страховка от ситуации «новый код работает на старой схеме»: ошибки вида «table public.robots does not exist» больше не зависят
# от того, прошла ли накатка схемы при выкладке (deploy/migrate.sh). Если db push не удался (например, мешают дубли для уникального
# индекса) — сайт всё равно стартует, причина пишется в журнал контейнера; отключить: SKIP_SCHEMA_PUSH=1.
if [ -n "$DATABASE_URL" ] && [ "${SKIP_SCHEMA_PUSH:-0}" != "1" ]; then
    echo "[entrypoint] проверяю схему базы (prisma db push)"
    if prisma db push --skip-generate --schema ./prisma/schema.prisma; then
        echo "[entrypoint] схема актуальна"
    else
        echo "[entrypoint] ВНИМАНИЕ: схему накатить не удалось — сайт запускается на текущей схеме, см. вывод выше" >&2
    fi
fi
exec node server.js
