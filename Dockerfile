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
COPY . .
RUN npx prisma generate && npm run build

# ── запуск ────────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS run
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
EXPOSE 3000
CMD ["node", "server.js"]
