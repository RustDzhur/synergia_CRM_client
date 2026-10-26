-- Налоговые реквизиты расходов (ELSTER/DATEV) и справочник категорий.
-- Миграция аддитивная и идемпотентная: её можно накатить и через `prisma migrate deploy`,
-- и вручную (`psql -f`) на базу, которая до этого велась через `prisma db push`.
-- Уже существующие расходы получают осмысленные значения: amount — это нетто, USt считается по ставке.

-- ── Expense: поля Beleg и Steuerliche Angaben ────────────────────────────────────────────────────
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "categoryCode"   TEXT NOT NULL DEFAULT '';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "subcategory"    TEXT NOT NULL DEFAULT '';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "datevAccount"   TEXT NOT NULL DEFAULT '';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "datevChart"     TEXT NOT NULL DEFAULT 'SKR03';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "netAmount"      DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "grossAmount"    DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "vatAmount"      DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "inputVatDeductible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "paidDate"       TEXT NOT NULL DEFAULT '';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "documentNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "vendorVatId"    TEXT NOT NULL DEFAULT '';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "vendorIban"     TEXT NOT NULL DEFAULT '';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "bookingKind"    TEXT NOT NULL DEFAULT 'Betriebsausgabe';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "afaYears"       DOUBLE PRECISION;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "afaResidualValue" DOUBLE PRECISION;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "folder"         TEXT NOT NULL DEFAULT '';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "reviewStatus"   TEXT NOT NULL DEFAULT 'REVIEW';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "confidence"     DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "manualFields"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "autoFields"     JSONB;

-- Старые строки: amount — нетто, gross/vat выводятся из taxRate; дата документа = date, номер = номер чека (если есть)
UPDATE "expenses"
   SET "netAmount" = "amount",
       "vatAmount" = ROUND(("amount" * "taxRate" / 100.0)::numeric, 2)::double precision,
       "grossAmount" = ROUND(("amount" * (1 + "taxRate" / 100.0))::numeric, 2)::double precision
 WHERE "netAmount" = 0 AND "amount" <> 0;

UPDATE "expenses" SET "folder" = 'Belege' WHERE "folder" = '' AND "receipt" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "expenses_org_reviewStatus_idx" ON "expenses" ("org", "reviewStatus");
CREATE INDEX IF NOT EXISTS "expenses_org_categoryCode_idx" ON "expenses" ("org", "categoryCode");

-- ── ExpenseCategory: справочник категорий (kategorie → podkategorie) ─────────────────────────────
CREATE TABLE IF NOT EXISTS "expense_categories" (
    "id"           TEXT NOT NULL,
    "code"         TEXT NOT NULL,
    "parentCode"   TEXT NOT NULL DEFAULT '',
    "isGroup"      BOOLEAN NOT NULL DEFAULT false,
    "nameDe"       TEXT NOT NULL,
    "nameEn"       TEXT NOT NULL,
    "nameRu"       TEXT NOT NULL,
    "nameUa"       TEXT NOT NULL DEFAULT '',
    "datevSkr03"   TEXT NOT NULL DEFAULT '',
    "datevSkr04"   TEXT NOT NULL DEFAULT '',
    "vatRate"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductible"   BOOLEAN NOT NULL DEFAULT true,
    "bookingKind"  TEXT NOT NULL DEFAULT 'Betriebsausgabe',
    "folder"       TEXT NOT NULL DEFAULT '',
    "afaYears"     DOUBLE PRECISION,
    "keywords"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "vendors"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sortOrder"    INTEGER NOT NULL DEFAULT 0,
    "active"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_code_key" ON "expense_categories" ("code");
CREATE INDEX IF NOT EXISTS "expense_categories_parentCode_idx" ON "expense_categories" ("parentCode");
CREATE INDEX IF NOT EXISTS "expense_categories_isGroup_sortOrder_idx" ON "expense_categories" ("isGroup", "sortOrder");

-- ── FinanceSettings: план счетов для новых расходов ──────────────────────────────────────────────
ALTER TABLE "financesettings" ADD COLUMN IF NOT EXISTS "datevChart" TEXT NOT NULL DEFAULT 'SKR03';
