// Seed справочника категорий расходов (ELSTER/DATEV) для Prisma.
// Запуск: node prisma/seed.mjs  (или npx prisma db seed — команда прописана в package.json)
// Идемпотентно: строки обновляются по стабильному code, пользовательские категории фирмы
// (FinanceSettings.expenseCategories) не затрагиваются. После seed GET /api/expense-categories
// отвечает source: "db"; без него форма пользуется тем же встроенным JSON-каталогом.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

const catalog = JSON.parse(readFileSync(new URL("../lib/finance/expenseCategoryCatalog.json", import.meta.url), "utf8"));

const bookingKind = (value) => (["Betriebsausgabe", "Investition", "Privatentnahme"].includes(value) ? value : "Betriebsausgabe");

let created = 0;
let updated = 0;
try {
    for (const row of catalog) {
        const data = {
            parentCode: String(row.parentCode ?? ""),
            isGroup: !!row.isGroup,
            nameDe: String(row.nameDe ?? ""),
            nameEn: String(row.nameEn ?? ""),
            nameRu: String(row.nameRu ?? ""),
            nameUa: String(row.nameUa ?? ""),
            datevSkr03: String(row.datevSkr03 ?? ""),
            datevSkr04: String(row.datevSkr04 ?? ""),
            vatRate: Number(row.vatRate) || 0,
            deductible: row.deductible !== false,
            bookingKind: bookingKind(row.bookingKind),
            folder: String(row.folder ?? ""),
            afaYears: row.afaYears == null ? null : Number(row.afaYears),
            keywords: Array.isArray(row.keywords) ? row.keywords.map(String) : [],
            vendors: Array.isArray(row.vendors) ? row.vendors.map(String) : [],
            sortOrder: Number(row.sortOrder) || 0,
            active: true,
        };
        const existing = await prisma.expenseCategory.findUnique({ where: { code: row.code }, select: { id: true } });
        if (existing) {
            await prisma.expenseCategory.update({ where: { code: row.code }, data });
            updated++;
        } else {
            await prisma.expenseCategory.create({ data: { code: row.code, ...data } });
            created++;
        }
    }
    const total = await prisma.expenseCategory.count();
    console.log(`[expense-categories] created ${created}, updated ${updated}, total ${total}`);
} catch (e) {
    console.error(`[expense-categories] seed failed: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
