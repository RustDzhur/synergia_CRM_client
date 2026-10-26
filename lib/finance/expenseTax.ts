// Налоговая арифметика и слияние автоопределения с ручной правкой. Чистый модуль: importable
// и сервером, и формой. Здесь нет ни базы, ни React — только правила, которые проверяются тестами.
import type { DatevChart, ExpenseBookingKind, ExpenseReviewStatus } from "./expenseCatalog";

/** Поля, которые человек может править вручную. Автоопределение их не перекрывает (см. manualFields). */
export const EXPENSE_TAX_FIELDS = [
    "vendor", "category", "categoryCode", "subcategory", "currency",
    "date", "paidDate", "documentNumber", "vendorVatId", "vendorIban",
    "netAmount", "grossAmount", "vatAmount", "taxRate", "inputVatDeductible",
    "datevAccount", "datevChart", "bookingKind", "afaYears", "afaResidualValue", "folder",
] as const;
export type ExpenseTaxField = (typeof EXPENSE_TAX_FIELDS)[number];

export interface NormalizedAmounts {
    netAmount: number;
    grossAmount: number;
    vatAmount: number;
    taxRate: number;
    /** Откуда взялась ставка: из документа, из категории или по умолчанию. */
    rateSource: "document" | "derived" | "default" | "none";
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
// null/undefined/"пусто" — это «значения нет», а не ноль: иначе normalizeAmounts считал бы
// отсутствующие netto/brutto заданными нулями и любые вычисления превращались бы в кашу.
const money = (n: unknown): number | null => {
    if (n === null || n === undefined || n === "") return null;
    const v = Number(n);
    return Number.isFinite(v) && v >= 0 ? round2(Math.min(v, 1_000_000_000)) : null;
};
const rateOf = (n: unknown): number | null => {
    if (n === null || n === undefined || n === "") return null;
    const v = Number(n);
    return Number.isFinite(v) && v >= 0 && v <= 100 ? round2(v) : null;
};

/**
 * Приводит netto/brutto/USt к согласованным значениям. Правило одно для формы, сервера и тестов:
 * две суммы уже заданы — третья считается из них; задана одна и ставка — вторая вычисляется;
 * ничего не задано — нули. Округление до центов, gross = net + vat.
 */
export function normalizeAmounts(
    input: { net?: number | null; gross?: number | null; vat?: number | null; rate?: number | null },
    opts: { defaultRate?: number } = {}
): NormalizedAmounts {
    const explicitRate = rateOf(input.rate);
    let rate = explicitRate ?? rateOf(opts.defaultRate) ?? 0;
    let net = money(input.net);
    let gross = money(input.gross);
    let vat = money(input.vat);
    // Ноль в net/gross из формы означает «поле не заполнено», а не реальную нулевую сумму:
    // иначе ввод только Brutto давал бы USt = Brutto. Нулевой USt при ставке 0 остаётся значимым.
    if (net === 0 && gross != null && gross > 0) net = null;
    if (gross === 0 && net != null && net > 0) gross = null;
    if (vat === 0 && rate > 0) vat = null; // «USt 0» при ставке 19 — это незаполненное поле, а не нулевой налог
    let rateSource: NormalizedAmounts["rateSource"] = explicitRate == null ? (opts.defaultRate == null ? "none" : "default") : "document";

    if (net != null && gross != null) {
        vat = round2(gross - net);
        if (vat < 0) {
            // В документе перепутаны местами netto/brutto — доверяем большей сумме как brutto
            [net, gross] = [gross, net];
            vat = round2(gross - net);
        }
        if (explicitRate == null) {
            rate = net > 0 ? round2((vat / net) * 100) : 0;
            rateSource = vat > 0 ? "derived" : "none";
        }
    } else if (gross != null) {
        if (vat != null && gross >= vat) {
            net = round2(gross - vat);
            if (explicitRate == null) {
                rate = net > 0 ? round2((vat / net) * 100) : 0;
                if (vat > 0) rateSource = "derived";
            }
        } else if (rate > 0) {
            net = round2(gross / (1 + rate / 100));
            vat = round2(gross - net);
        } else {
            net = gross;
            vat = 0;
        }
    } else if (net != null) {
        if (vat != null) {
            gross = round2(net + vat);
            if (explicitRate == null) {
                rate = net > 0 ? round2((vat / net) * 100) : 0;
                if (vat > 0) rateSource = "derived";
            }
        } else if (rate > 0) {
            vat = round2((net * rate) / 100);
            gross = round2(net + vat);
        } else {
            gross = net;
            vat = 0;
        }
    } else if (vat != null && rate > 0) {
        // На документе видна только сумма налога — восстанавливаем базу
        net = round2(vat / (rate / 100));
        gross = round2(net + vat);
        rateSource = explicitRate == null ? "derived" : rateSource;
    } else {
        net = net ?? 0;
        gross = gross ?? 0;
        vat = vat ?? 0;
    }

    // Итоговая сверка: даже при «красивых» входных числах сумма должна сходиться до цента
    net = round2(Math.max(0, net ?? 0));
    gross = round2(Math.max(0, gross ?? 0));
    vat = round2(Math.max(0, gross - net));
    if (gross === 0 && net > 0) gross = round2(net + vat);
    if (net === 0 && gross > 0 && vat > 0) net = round2(gross - vat);
    return { netAmount: net, grossAmount: gross, vatAmount: vat, taxRate: rate, rateSource };
}

/** Поля, которые может предложить автоопределение (documentDate — это Expense.date). */
export interface ExpenseProposal {
    vendor: string;
    documentNumber: string;
    documentDate: string;
    paidDate: string;
    currency: string;
    netAmount: number;
    grossAmount: number;
    vatAmount: number;
    taxRate: number;
    inputVatDeductible: boolean;
    category: string;
    categoryCode: string;
    subcategory: string;
    datevAccount: string;
    datevChart: DatevChart;
    bookingKind: ExpenseBookingKind;
    afaYears: number | null;
    afaResidualValue: number | null;
    folder: string;
    vendorVatId: string;
    vendorIban: string;
}

export type ProposalField = keyof ExpenseProposal;

/** Какие поля автоопределение реально нашло (пустые/нулевые значения не считаются находкой). */
export type DetectedFields = ProposalField[];

const PROPOSAL_TO_DB: Record<ProposalField, string> = {
    vendor: "vendor",
    documentNumber: "documentNumber",
    documentDate: "date",
    paidDate: "paidDate",
    currency: "currency",
    netAmount: "netAmount",
    grossAmount: "grossAmount",
    vatAmount: "vatAmount",
    taxRate: "taxRate",
    inputVatDeductible: "inputVatDeductible",
    category: "category",
    categoryCode: "categoryCode",
    subcategory: "subcategory",
    datevAccount: "datevAccount",
    datevChart: "datevChart",
    bookingKind: "bookingKind",
    afaYears: "afaYears",
    afaResidualValue: "afaResidualValue",
    folder: "folder",
    vendorVatId: "vendorVatId",
    vendorIban: "vendorIban",
};

export const dbFieldFor = (field: ProposalField): string => PROPOSAL_TO_DB[field];

export interface MergeResult {
    /** Готовый data для prisma.expense.update: только реально изменённые поля. */
    data: Record<string, unknown>;
    applied: ProposalField[];
    skipped: ProposalField[];
    reviewStatus: ExpenseReviewStatus;
}

const sameValue = (a: unknown, b: unknown): boolean => {
    if (typeof a === "number" || typeof b === "number") return Math.abs(Number(a) - Number(b)) < 0.005;
    if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) === Boolean(b);
    return String(a ?? "") === String(b ?? "");
};

/**
 * Слияние предложения автоопределения с текущим расходом. Ручные поля (manualFields) не трогаем,
 * пока не передан overwrite. Уже совпадающие значения не пишем — лишний UPDATE в закрытом периоде
 * был бы лишним поводом для отказа.
 */
export function mergeAutofill(
    current: Record<string, unknown>,
    proposal: ExpenseProposal,
    detected: DetectedFields,
    opts: { overwrite?: boolean; currentReviewStatus?: string; confidence?: number } = {}
): MergeResult {
    const manual = new Set<string>(Array.isArray(current.manualFields) ? (current.manualFields as string[]) : []);
    const data: Record<string, unknown> = {};
    const applied: ProposalField[] = [];
    const skipped: ProposalField[] = [];
    const chart = proposal.datevChart;

    for (const field of detected) {
        const dbField = PROPOSAL_TO_DB[field];
        const value = proposal[field];
        if (manual.has(dbField) && !opts.overwrite) {
            skipped.push(field);
            continue;
        }
        if (sameValue(current[dbField], value)) continue;
        data[dbField] = value;
        applied.push(field);
    }
    // План счетов — свойство фирмы, а не документа: применяем вместе с найденным счётом
    if (applied.includes("datevAccount") && current.datevChart !== chart) data.datevChart = chart;

    const currentStatus = opts.currentReviewStatus ?? String(current.reviewStatus ?? "");
    // Подтверждённый бухгалтером расход не «переоткрываем» без явного overwrite
    const keepOk = currentStatus === "OK" && !opts.overwrite;
    // Если часть полей человек уже правил, это не «чисто автоматический» документ — на проверку
    const reviewStatus = keepOk ? "OK" : skipped.length ? "REVIEW" : (opts.confidence ?? 0) >= 0.8 ? "AUTO" : "REVIEW";
    return { data, applied, skipped, reviewStatus };
}
