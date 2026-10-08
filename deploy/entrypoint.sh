#!/bin/sh
# Запуск контейнера: сначала досыпаем в базу недостающие таблицы и колонки (схема только дополняется), потом стартует сайт.
# Это страховка от ситуации «новый код работает на старой схеме». Если db push не удался — сайт всё равно стартует,
# причина пишется в журнал контейнера; отключить: SKIP_SCHEMA_PUSH=1.
#
# Prisma считает «возможной потерей данных» и новые уникальные индексы (org, number): при дублях они не лягут и без флага, а без дублей это безопасно.
# Поэтому повторяем с --accept-data-loss ТОЛЬКО если все предупреждения — про уникальные ограничения. Любое другое предупреждение
# (удаление таблицы или колонки, смена типа) флагом не принимается: схема остаётся прежней, сайт стартует на ней.
if [ -n "$DATABASE_URL" ] && [ "${SKIP_SCHEMA_PUSH:-0}" != "1" ]; then
    echo "[entrypoint] проверяю схему базы (prisma db push)"
    OUT="$(prisma db push --skip-generate --schema ./prisma/schema.prisma 2>&1)"
    CODE=$?
    echo "$OUT"
    if [ $CODE -ne 0 ] && echo "$OUT" | grep -q "accept-data-loss"; then
        WARNINGS="$(echo "$OUT" | grep '^  • ' || true)"
        if [ -n "$WARNINGS" ] && [ -z "$(echo "$WARNINGS" | grep -v 'unique constraint')" ]; then
            echo "[entrypoint] предупреждения только про уникальные индексы — повторяю с --accept-data-loss"
            prisma db push --skip-generate --accept-data-loss --schema ./prisma/schema.prisma
            CODE=$?
        else
            echo "[entrypoint] среди предупреждений есть не только уникальные индексы — автоматически не принимаю" >&2
        fi
    fi
    if [ $CODE -eq 0 ]; then
        echo "[entrypoint] схема актуальна"
    else
        echo "[entrypoint] ВНИМАНИЕ: схему накатить не удалось — сайт запускается на текущей схеме, см. вывод выше" >&2
    fi
fi
exec node server.js
