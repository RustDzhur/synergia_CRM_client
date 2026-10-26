# Миграции Prisma

До этой задачи база велась через `npx prisma db push` (см. `docs/SYNC.md`), поэтому каталога
`prisma/migrations` не было. Для налоговых полей расходов добавлена первая аддитивная миграция
`20261026190000_expense_tax_fields`; её SQL идемпотентен (`IF NOT EXISTS`, повторный запуск безопасен).

## Порядок для уже существующей базы (создана db push)

`prisma migrate deploy` на такой базе ответит `P3005: The database schema is not empty` — это
нормально, Prisma требует baseline. Есть два равнозначных пути:

```bash
# 1) применить SQL вручную (идемпотентно)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f prisma/migrations/20261026190000_expense_tax_fields/migration.sql

# 2) отметить миграцию как применённую, чтобы дальше работал migrate deploy
npx prisma migrate resolve --applied 20261026190000_expense_tax_fields

# затем справочник категорий
node prisma/seed.mjs        # или npx prisma db seed
```

Применить SQL можно и через Prisma, без psql:

```bash
npx prisma db execute --file prisma/migrations/20261026190000_expense_tax_fields/migration.sql --schema prisma/schema.prisma
```

## Порядок для новой базы

```bash
npx prisma migrate deploy
node prisma/seed.mjs
```

Если команда продолжает использовать `prisma db push`, миграция не мешает: `db push` применяет
схему напрямую, а seed наполняет `expense_categories`. Без seed справочник берётся из
`lib/finance/expenseCategoryCatalog.json` (fallback в `lib/finance/expenseCatalogDb.ts`).
