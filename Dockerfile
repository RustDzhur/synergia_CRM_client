# Сборка приложения Firmspace CRM для собственного сервера: один образ, внутри — Next.js
# в режиме standalone. База данных — PostgreSQL (внешняя, переменная DATABASE_URL),
# файлы — каталог на диске (LOCAL_STORAGE_ROOT, монтируется томом).

# ── сборка ────────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
# npm ci требует идеально совпадающего lock-файла; npm install ставит по package.json
# и дозаполняет мелочи вроде транзитивных @types
RUN npm install --no-audit --no-fund
# Prisma выбирает движок по версии libssl В МОМЕНТ ГЕНЕРАЦИИ: без openssl она берёт 1.1.x,
# а в runtime-образе OpenSSL 3 — движок не загрузится и подключение падает с пустой ошибкой.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npx prisma generate && npm run build

# ── запуск ────────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS run
# Prisma-движку нужен OpenSSL: в slim-образе его нет, и Prisma не может определить версию
# (падает с «Database error» вместо подключения)
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# CLI Prisma нужен только для накатки схемы при старте (deploy/entrypoint.sh); версия та же, что у клиента в package.json
RUN npm install -g prisma@5.22.0 --no-audit --no-fund
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# standalone-сборка уже содержит нужные части node_modules; клиент Prisma и его движки
# копируем отдельно — их генератор кладёт вне обычного дерева зависимостей
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/deploy/entrypoint.sh /entrypoint.sh
# разовый идемпотентный перенос данных Робот-офиса в таблицы (вызывается из entrypoint.sh)
COPY --from=build /app/scripts/migrate-office.mjs ./scripts/migrate-office.mjs
EXPOSE 3000
CMD ["/entrypoint.sh"]
