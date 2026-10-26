// Разбор налоговых полей расхода из тела запроса: одна проверка для POST и PATCH.
// Здесь же — приведение кодов справочника: клиент присылает код подкатегории, сервер сам
// находит группу, счёт DATEV, папку и вид бухгалтерской записи. Ручные правки отмечаются
// в manualFields по фактическому изменению значения, а не по факту отправки формы целиком.
import {
    DATEV_CHARTS,
    EXPENSE_BOOKING_KINDS,
    EXPENSE_REVIEW_STATUSES,
    catalogEntry,
    catalogGroup,
    datevAccountFor,
    resolveCategoryCode,
    resolveSubcategoryCode,
    type DatevChart,
    type ExpenseBookingKind,
    type ExpenseCatalogEntry,
    type ExpenseReviewStatus,
} from "./expenseCatalog";
import { EXPENSE_TAX_FIELDS, normalizeAmounts, type NormalizedAmounts } from "./expenseTax";

export class ExpenseInputError extends Error {}

const clean = (v: unknown, max: number): string =>
    typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

const has = (body: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(body, key);

const parseDate = (v: unknown, field: string): string => {
    if (v === null || v === undefined || v === "") return "";
    const s = String(v).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ExpenseInputError(`${field} must be a date in YYYY-MM-DD format`);
    const d = new Date(`${s}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new ExpenseInputError(`${field} is not a valid date`);
    return s;
};

const parseMoney = (v: unknown, field: string): number => {
    const n = typeof v === "string" ? Number(v.replace(/\s/g, "").replace(",", ".")) : Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) throw new ExpenseInputError(`${field} must be a non-negative number`);
    return Math.round(n * 100) / 100;
};

const parseNumber = (v: unknown, field: string, min: number, max: number): number => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw new ExpenseInputError(`${field} must be between ${min} and ${max}`);
    return n;
};

const parseBool = (v: unknown): boolean => v === true || v === "true" || v === 1 || v === "1";

const parseEnum = <T extends string>(v: unknown, values: readonly T[], field: string): T => {
    const s = String(v ?? "");
    if (!values.includes(s as T)) throw new ExpenseInputError(`${field} must be one of: ${values.join(", ")}`);
    return s as T;
};

/** IBAN: пробелы убираем, регистр верхний, контрольную сумму (mod 97) проверяем — опечатка в реквизите дороже отказа. */
export function normalizeIban(input: unknown): string {
    if (input === null || input === undefined || input === "") return "";
    const iban = String(input).replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban) || iban.length < 15 || iban.length > 34) throw new ExpenseInputError("IBAN is not valid");
    const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
    const digits = Array.from(rearranged, (c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c)).join("");
    const mod = digits.split("").reduce((acc, ch) => (acc * 10 + Number(ch)) % 97, 0);
    if (mod !== 1) throw new ExpenseInputError("IBAN checksum is not valid");
    return iban;
}

/** USt-IdNr.: формат страны + латиница/цифры; для Германии ровно DE + 9 цифр. */
export function normalizeVatId(input: unknown): string {
    if (input === null || input === undefined || input === "") return "";
    const id = String(input).replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{2}[A-Z0-9]{6,14}$/.test(id)) throw new ExpenseInputError("VAT ID is not valid");
    if (id.startsWith("DE") && !/^DE\d{9}$/.test(id)) throw new ExpenseInputError("German VAT ID must be DE followed by 9 digits");
    return id;
}

export interface ParsedExpenseFields {
    vendor?: string;
    category?: string;
    categoryCode?: string;
    subcategory?: string;
    currency?: string;
    date?: string;
    paidDate?: string;
    documentNumber?: string;
    vendorVatId?: string;
    vendorIban?: string;
    netAmount?: number;
    grossAmount?: number;
    vatAmount?: number;
    taxRate?: number;
    inputVatDeductible?: boolean;
    datevAccount?: string;
    datevChart?: DatevChart;
    bookingKind?: ExpenseBookingKind;
    afaYears?: number | null;
    afaResidualValue?: number | null;
    folder?: string;
    reviewStatus?: ExpenseReviewStatus;
    confidence?: number;
}

export interface ParseExpenseOptions {
    /** План счетов по умолчанию (FinanceSettings.datevChart) — для счёта, если его не прислали. */
    chart: DatevChart;
    /** Справочник: из базы, если seed уже накатан, иначе встроенный. */
    categories?: ExpenseCatalogEntry[];
    /** PATCH: не выводить суммы из одной ставки, чтобы не обнулить уже записанные netto/brutto. */
    mode: "create" | "patch";
    /** Текущая ставка расхода (PATCH): нужна, если прислали только одну сумму без ставки. */
    currentTaxRate?: number;
}

/**
 * Разбирает известные налоговые поля. Неизвестные ключи игнорируются: их принимают соседние
 * ветки маршрута (сделка, заказ, чек, примечания). Ошибка формата — ExpenseInputError → 400.
 */
export function parseExpenseFields(body: unknown, opts: ParseExpenseOptions): ParsedExpenseFields {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ExpenseInputError("Invalid request body");
    const b = body as Record<string, unknown>;
    const categories = opts.categories;
    const out: ParsedExpenseFields = {};

    if (has(b, "vendor")) {
        const vendor = clean(b.vendor, 200);
        if (!vendor) throw new ExpenseInputError("vendor is required");
        out.vendor = vendor;
    }
    if (has(b, "category")) out.category = clean(b.category, 100);

    // Подкатегория: сначала код; если клиент прислал старое название — найдём по названию
    const rawSub = has(b, "subcategory") ? resolveSubcategoryCode(clean(b.subcategory, 60), categories) : "";
    const leaf = rawSub ? catalogEntry(rawSub, categories) : null;
    if (has(b, "subcategory") && clean(b.subcategory, 60) && !leaf) throw new ExpenseInputError("Unknown expense subcategory");

    let groupCode = "";
    if (has(b, "categoryCode")) {
        const raw = clean(b.categoryCode, 60);
        if (!raw) {
            out.categoryCode = ""; // явная очистка категории из формы
            if (!has(b, "subcategory")) out.subcategory = "";
        }
        groupCode = resolveCategoryCode(raw, categories);
        if (raw && !groupCode) throw new ExpenseInputError("Unknown expense category");
    }
    if (leaf && groupCode && leaf.parentCode !== groupCode) {
        // Подкатегория важнее: группа должна соответствовать листу, иначе расход разнесётся не туда
        groupCode = leaf.parentCode;
    }
    if (!groupCode && leaf) groupCode = leaf.parentCode;
    if (groupCode) {
        out.categoryCode = groupCode;
        if (leaf) out.subcategory = leaf.code;
    } else if (has(b, "subcategory")) {
        out.subcategory = "";
    }

    if (has(b, "currency")) {
        const currency = clean(b.currency, 6).toUpperCase();
        if (currency && !/^[A-Z]{3,6}$/.test(currency)) throw new ExpenseInputError("currency is not valid");
        out.currency = currency;
    }
    if (has(b, "documentDate") || has(b, "date")) out.date = parseDate(has(b, "documentDate") ? b.documentDate : b.date, "documentDate");
    if (has(b, "paidDate") || has(b, "paymentDate")) out.paidDate = parseDate(has(b, "paidDate") ? b.paidDate : b.paymentDate, "paidDate");
    if (has(b, "documentNumber")) out.documentNumber = clean(b.documentNumber, 80);
    if (has(b, "vendorVatId") || has(b, "vatId")) out.vendorVatId = normalizeVatId(has(b, "vendorVatId") ? b.vendorVatId : b.vatId);
    if (has(b, "vendorIban") || has(b, "iban")) out.vendorIban = normalizeIban(has(b, "vendorIban") ? b.vendorIban : b.iban);

    const chartRaw = has(b, "datevChart") ? String(b.datevChart) : opts.chart;
    const chart = DATEV_CHARTS.includes(chartRaw as DatevChart) ? (chartRaw as DatevChart) : opts.chart;
    out.datevChart = chart;

    if (has(b, "datevAccount")) {
        const account = clean(b.datevAccount, 8);
        if (account && !/^\d{3,6}$/.test(account)) throw new ExpenseInputError("DATEV account must contain 3–6 digits");
        out.datevAccount = account;
    }
    if (has(b, "bookingKind")) out.bookingKind = parseEnum(b.bookingKind, EXPENSE_BOOKING_KINDS, "bookingKind");
    const afaProvided = has(b, "afaYears");
    if (afaProvided) out.afaYears = b.afaYears === null || b.afaYears === "" ? null : parseNumber(b.afaYears, "afaYears", 1, 100);
    if (has(b, "afaResidualValue")) out.afaResidualValue = b.afaResidualValue === null || b.afaResidualValue === "" ? null : parseMoney(b.afaResidualValue, "afaResidualValue");
    if (has(b, "folder")) out.folder = clean(b.folder, 200);
    if (has(b, "inputVatDeductible")) out.inputVatDeductible = parseBool(b.inputVatDeductible);
    if (has(b, "reviewStatus")) out.reviewStatus = parseEnum(b.reviewStatus, EXPENSE_REVIEW_STATUSES, "reviewStatus");
    if (has(b, "confidence")) out.confidence = parseNumber(b.confidence, "confidence", 0, 1);

    // Суммы: считаем только если пришла хотя бы одна сумма или ставка. При PATCH одна ставка
    // без сумм не должна обнулять netto/brutto — их досчитает форма, если нужно.
    const hasMoney = ["amount", "netAmount", "grossAmount", "vatAmount", "taxAmount", "taxRate", "ustRate", "vatRate"].some((k) => has(b, k));
    const hasNetOrGross = ["amount", "netAmount", "grossAmount", "vatAmount", "taxAmount"].some((k) => has(b, k));
    const hasBase = ["amount", "netAmount", "grossAmount"].some((k) => has(b, k));
    const hasVat = has(b, "vatAmount") || has(b, "taxAmount");
    if (hasMoney) {
        const rateProvided = has(b, "taxRate") || has(b, "ustRate") || has(b, "vatRate");
        const rateRaw = has(b, "taxRate") ? b.taxRate : has(b, "ustRate") ? b.ustRate : has(b, "vatRate") ? b.vatRate : null;
        const rate = rateProvided && rateRaw !== null && rateRaw !== "" ? parseNumber(rateRaw, "taxRate", 0, 100) : null;
        if (hasVat && !hasBase && rate == null && opts.currentTaxRate == null) throw new ExpenseInputError("vatAmount requires netAmount, grossAmount or taxRate");
        if (hasNetOrGross) {
            // Только одна сумма без ставки в PATCH: считаем по уже сохранённой ставке, иначе
            // «Brutto 119» при ставке 19 превратилось бы в Netto 119 с нулевым налогом.
            const rateForCalc = rate ?? (opts.currentTaxRate != null && Number.isFinite(opts.currentTaxRate) ? opts.currentTaxRate : null);
            const amounts: NormalizedAmounts = normalizeAmounts(
                {
                    net: has(b, "netAmount") ? parseMoney(b.netAmount, "netAmount") : has(b, "amount") ? parseMoney(b.amount, "amount") : null,
                    gross: has(b, "grossAmount") ? parseMoney(b.grossAmount, "grossAmount") : null,
                    vat: has(b, "vatAmount") ? parseMoney(b.vatAmount, "vatAmount") : has(b, "taxAmount") ? parseMoney(b.taxAmount, "taxAmount") : null,
                    rate: rateForCalc,
                },
                { defaultRate: 0 }
            );
            out.netAmount = amounts.netAmount;
            out.grossAmount = amounts.grossAmount;
            out.vatAmount = amounts.vatAmount;
            // Ставку не выдумываем из одной суммы: иначе PATCH только с netto обнулил бы уже
            // сохранённые 19 %. Пишем её, если прислали явно или если она выведена из двух сумм.
            if (rateProvided || amounts.rateSource === "derived") out.taxRate = amounts.taxRate;
        } else if (rate != null) {
            out.taxRate = rate;
        }
    }

    // Предзаполнение из справочника: счёт, папка, вид записи, AfA. Суммы и ставку не трогаем —
    // это учётные данные, их подтверждает человек.
    const defaults = leaf ? catalogDefaultsSafely(leaf.code, chart, categories) : null;
    if (defaults && leaf) {
        if (!has(b, "category")) out.category = leaf.nameDe;
        if (out.datevAccount == null) out.datevAccount = defaults.datevAccount;
        if (out.folder == null) out.folder = defaults.folder;
        if (out.bookingKind == null) out.bookingKind = defaults.bookingKind;
        if (!afaProvided && out.afaYears == null && defaults.afaYears != null && out.bookingKind !== "Privatentnahme") out.afaYears = defaults.afaYears;
    } else if (groupCode) {
        const group = catalogGroup(groupCode, categories);
        if (out.folder == null && group?.folder) out.folder = group.folder;
    }

    return out;
}

function catalogDefaultsSafely(code: string, chart: DatevChart, categories?: ExpenseCatalogEntry[]) {
    const leaf = catalogEntry(code, categories);
    if (!leaf || leaf.isGroup) return null;
    return {
        datevAccount: datevAccountFor(leaf, chart),
        folder: leaf.folder,
        bookingKind: leaf.bookingKind,
        afaYears: leaf.afaYears,
    };
}

/** Поля, которые PATCH считает «ручной правкой» и добавляет в manualFields. */
export function manualFieldsAfterPatch(current: Record<string, unknown>, parsed: ParsedExpenseFields): string[] {
    const manual = new Set<string>(Array.isArray(current.manualFields) ? (current.manualFields as string[]) : []);
    const fields = EXPENSE_TAX_FIELDS as readonly string[];
    for (const [key, value] of Object.entries(parsed)) {
        if (!fields.includes(key)) continue;
        if (key === "afaYears" || key === "afaResidualValue") {
            const cur = current[key];
            const a = cur == null ? null : Number(cur);
            const b = value == null ? null : Number(value);
            if (a !== b) manual.add(key);
            continue;
        }
        if (typeof value === "number" || typeof current[key] === "number") {
            if (Math.abs(Number(current[key]) - Number(value)) >= 0.005) manual.add(key);
        } else if (String(current[key] ?? "") !== String(value ?? "")) {
            manual.add(key);
        }
    }
    return Array.from(manual);
}
