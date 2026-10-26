// Справочник категорий расходов (ELSTER/DATEV) — чистый модуль: те же данные нужны серверу
// (автоопределение, экспорт), браузеру (форма и фильтры) и скрипту seed. Поэтому каталог лежит
// отдельным JSON, а здесь — типы и функции поиска/локализации. База (expense_categories) наполняется
// из этого же JSON, но интерфейс продолжает работать и до seed: fallback — сам каталог.
//
// Дерево двухуровневое: группа (isGroup) → подкатегория с конкретным счётом DATEV. В расходе
// categoryCode хранит код группы, subcategory — код подкатегории: переименование названий не ломает
// уже разнесённые документы, потому что коды стабильны.
import catalogJson from "./expenseCategoryCatalog.json";

export type ExpenseBookingKind = "Betriebsausgabe" | "Investition" | "Privatentnahme";
export type ExpenseReviewStatus = "AUTO" | "REVIEW" | "OK";
export type DatevChart = "SKR03" | "SKR04";

export const EXPENSE_BOOKING_KINDS: ExpenseBookingKind[] = ["Betriebsausgabe", "Investition", "Privatentnahme"];
export const EXPENSE_REVIEW_STATUSES: ExpenseReviewStatus[] = ["AUTO", "REVIEW", "OK"];
export const DATEV_CHARTS: DatevChart[] = ["SKR03", "SKR04"];

export interface ExpenseCatalogEntry {
    code: string;
    parentCode: string;
    isGroup: boolean;
    nameDe: string;
    nameEn: string;
    nameRu: string;
    nameUa: string;
    datevSkr03: string;
    datevSkr04: string;
    vatRate: number;
    deductible: boolean;
    bookingKind: ExpenseBookingKind;
    folder: string;
    afaYears: number | null;
    keywords: string[];
    vendors: string[];
    sortOrder: number;
}

export const EXPENSE_CATEGORY_CATALOG = catalogJson as unknown as ExpenseCatalogEntry[];

const BY_CODE = new Map(EXPENSE_CATEGORY_CATALOG.map((e) => [e.code, e]));

export const EXPENSE_CATEGORY_GROUPS = EXPENSE_CATEGORY_CATALOG.filter((e) => e.isGroup);
export const EXPENSE_CATEGORY_LEAVES = EXPENSE_CATEGORY_CATALOG.filter((e) => !e.isGroup);

/** Категория по коду; null для пустого/неизвестного кода. */
export const catalogEntry = (code: string, entries: ExpenseCatalogEntry[] = EXPENSE_CATEGORY_CATALOG): ExpenseCatalogEntry | null =>
    entries.find((e) => e.code === code) ?? (entries === EXPENSE_CATEGORY_CATALOG ? BY_CODE.get(code) ?? null : null);

/** Подкатегории категории (или пустой список для листа). */
export const catalogChildren = (parentCode: string, entries: ExpenseCatalogEntry[] = EXPENSE_CATEGORY_CATALOG): ExpenseCatalogEntry[] =>
    entries.filter((e) => !e.isGroup && e.parentCode === parentCode).sort((a, b) => a.sortOrder - b.sortOrder);

/** Группа, к которой относится категория (для листа — родитель, для группы — сама). */
export function catalogGroup(code: string, entries: ExpenseCatalogEntry[] = EXPENSE_CATEGORY_CATALOG): ExpenseCatalogEntry | null {
    const entry = catalogEntry(code, entries);
    if (!entry) return null;
    return entry.isGroup ? entry : catalogEntry(entry.parentCode, entries);
}

/** Название на языке интерфейса; незнакомый язык получает английское (как и запасные переводы uz). */
export function catalogName(entry: ExpenseCatalogEntry, locale: string): string {
    if (locale === "de") return entry.nameDe;
    if (locale === "ua" || locale === "uk") return entry.nameUa || entry.nameEn;
    if (locale === "ru") return entry.nameRu;
    return entry.nameEn || entry.nameDe;
}

/** Счёт DATEV для выбранного плана счетов; пустая строка, если у категории его нет. */
export const datevAccountFor = (entry: ExpenseCatalogEntry | null, chart: DatevChart): string =>
    !entry ? "" : chart === "SKR04" ? entry.datevSkr04 : entry.datevSkr03;

/** Предзаполнение расхода по выбранной подкатегории: счёт, папка, вид бухгалтерской записи, AfA. */
export interface CatalogDefaults {
    category: string;
    categoryCode: string;
    subcategory: string;
    datevAccount: string;
    folder: string;
    bookingKind: ExpenseBookingKind;
    afaYears: number | null;
    vatRate: number;
    deductible: boolean;
}

export function catalogDefaults(code: string, chart: DatevChart, entries: ExpenseCatalogEntry[] = EXPENSE_CATEGORY_CATALOG): CatalogDefaults | null {
    const entry = catalogEntry(code, entries);
    if (!entry || entry.isGroup) return null;
    const group = catalogEntry(entry.parentCode, entries);
    return {
        category: entry.nameDe,
        categoryCode: group?.code ?? entry.parentCode,
        subcategory: entry.code,
        datevAccount: datevAccountFor(entry, chart),
        folder: entry.folder,
        bookingKind: entry.bookingKind,
        afaYears: entry.afaYears,
        vatRate: entry.vatRate,
        deductible: entry.deductible,
    };
}

/** Код подкатегории из свободного значения: принимает и код, и немецкое название (старые данные/импорт). */
export function resolveSubcategoryCode(value: string, entries: ExpenseCatalogEntry[] = EXPENSE_CATEGORY_CATALOG): string {
    const needle = String(value ?? "").trim();
    if (!needle) return "";
    const direct = catalogEntry(needle, entries);
    if (direct && !direct.isGroup) return direct.code;
    const lower = needle.toLowerCase();
    const match = entries.find((e) => !e.isGroup && (e.nameDe.toLowerCase() === lower || e.nameEn.toLowerCase() === lower));
    return match?.code ?? "";
}

/** Код группы по коду группы/подкатегории (для фильтров списка расходов). */
export function resolveCategoryCode(value: string, entries: ExpenseCatalogEntry[] = EXPENSE_CATEGORY_CATALOG): string {
    const entry = catalogEntry(value, entries);
    if (!entry) return "";
    return entry.isGroup ? entry.code : entry.parentCode;
}

/** Строка, пригодная для поля «Ordner»: папка категории или Belege/<год>. */
export function folderForCategory(code: string, fallbackYear: string, entries: ExpenseCatalogEntry[] = EXPENSE_CATEGORY_CATALOG): string {
    const entry = catalogEntry(code, entries);
    if (entry?.folder) return entry.folder;
    const group = catalogGroup(code, entries);
    return group?.folder || `Belege/${fallbackYear}`;
}
