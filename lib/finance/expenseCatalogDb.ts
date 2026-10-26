// Загрузка справочника категорий из базы (после seed) с откатом на встроенный каталог.
// Так форма и автоопределение работают и до `node prisma/seed.mjs`: пока таблица пуста или
// ещё не создана, используется тот же JSON, из которого seed её наполняет.
import { prisma } from "@/lib/prisma";
import { EXPENSE_CATEGORY_CATALOG, type ExpenseCatalogEntry, type ExpenseBookingKind } from "./expenseCatalog";

const asKind = (v: unknown): ExpenseBookingKind =>
    v === "Investition" || v === "Privatentnahme" ? v : "Betriebsausgabe";

const toEntry = (row: {
    code: string; parentCode: string; isGroup: boolean; nameDe: string; nameEn: string; nameRu: string; nameUa: string;
    datevSkr03: string; datevSkr04: string; vatRate: number; deductible: boolean; bookingKind: string;
    folder: string; afaYears: number | null; keywords: string[]; vendors: string[]; sortOrder: number;
}): ExpenseCatalogEntry => ({
    code: row.code,
    parentCode: row.parentCode,
    isGroup: row.isGroup,
    nameDe: row.nameDe,
    nameEn: row.nameEn,
    nameRu: row.nameRu,
    nameUa: row.nameUa,
    datevSkr03: row.datevSkr03,
    datevSkr04: row.datevSkr04,
    vatRate: Number(row.vatRate) || 0,
    deductible: !!row.deductible,
    bookingKind: asKind(row.bookingKind),
    folder: row.folder,
    afaYears: row.afaYears == null ? null : Number(row.afaYears),
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    vendors: Array.isArray(row.vendors) ? row.vendors : [],
    sortOrder: Number(row.sortOrder) || 0,
});

export interface LoadedCategories {
    entries: ExpenseCatalogEntry[];
    source: "db" | "catalog";
}

/** Категории фирмы: активные строки базы, а если их нет — встроенный каталог. */
export async function loadExpenseCategories(): Promise<LoadedCategories> {
    try {
        // Таблица может ещё не существовать (миграция не накатана): проверяем заранее, чтобы не
        // ловить P2021 в общем сторожe базы (он сообщает о таких ошибках владельцу).
        const present = await prisma.$queryRaw<Array<{ present: boolean }>>`SELECT to_regclass('public.expense_categories') IS NOT NULL AS present`;
        if (!present[0]?.present) return { entries: EXPENSE_CATEGORY_CATALOG, source: "catalog" };
        const rows = await prisma.expenseCategory.findMany({
            where: { active: true },
            orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
            select: {
                code: true, parentCode: true, isGroup: true, nameDe: true, nameEn: true, nameRu: true, nameUa: true,
                datevSkr03: true, datevSkr04: true, vatRate: true, deductible: true, bookingKind: true, folder: true,
                afaYears: true, keywords: true, vendors: true, sortOrder: true,
            },
        });
        if (rows.length) return { entries: rows.map(toEntry), source: "db" };
    } catch {
        // Таблицы ещё нет (миграция не накатана) — справочник из кода полностью рабочий.
    }
    return { entries: EXPENSE_CATEGORY_CATALOG, source: "catalog" };
}
