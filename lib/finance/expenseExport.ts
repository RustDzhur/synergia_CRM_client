// Экспорт расходов для бухгалтера: колонки в порядке/именах, привычных DATEV-импорту
// (Belegdatum, Belegfeld, Konto SKR03/04, Netto/USt/Brutto, Buchungsart, AfA…). Чистая функция:
// маршрут только выбирает строки из базы, поэтому колонки и суммы проверяются тестом.
import { catalogEntry, type ExpenseCatalogEntry } from "./expenseCatalog";

export const EXPENSE_EXPORT_COLUMNS = [
    "Belegdatum",
    "Belegfeld 1",
    "Belegfeld 2",
    "Lieferant",
    "USt-IdNr. Lieferant",
    "IBAN Lieferant",
    "Kategorie-Code",
    "Kategorie",
    "Unterkategorie-Code",
    "Unterkategorie",
    "DATEV-Konto SKR03",
    "DATEV-Konto SKR04",
    "Netto",
    "USt-Satz",
    "USt-Betrag",
    "Brutto",
    "Vorsteuer abziehbar",
    "Buchungsart",
    "AfA-Jahre",
    "AfA-Restwert",
    "Ordner",
    "Zahlungsdatum",
    "Prüfstatus",
    "Konfidenz (%)",
    "Währung",
    "Notizen",
] as const;

export interface ExpenseExportSource {
    date: string;
    documentNumber: string;
    vendor: string;
    vendorVatId: string;
    vendorIban: string;
    category: string;
    categoryCode: string;
    subcategory: string;
    datevAccount: string;
    datevChart: string;
    amount: number;
    netAmount: number;
    grossAmount: number;
    vatAmount: number;
    taxRate: number;
    inputVatDeductible: boolean;
    bookingKind: string;
    afaYears: number | null;
    afaResidualValue: number | null;
    folder: string;
    paidDate: string;
    reviewStatus: string;
    confidence: number;
    currency: string;
    notes: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Три суммы согласованы: старые строки без net/gross тоже дают верные Netto/USt/Brutto. */
export function exportAmounts(e: Pick<ExpenseExportSource, "amount" | "netAmount" | "grossAmount" | "vatAmount" | "taxRate">): { net: number; vat: number; gross: number } {
    const rate = Number(e.taxRate) || 0;
    let net = Number(e.netAmount) || 0;
    let gross = Number(e.grossAmount) || 0;
    let vat = Number(e.vatAmount) || 0;
    if (!net && !gross) net = Number(e.amount) || 0;
    if (!net && gross > 0) {
        net = rate > 0 ? round2(gross / (1 + rate / 100)) : gross;
        vat = round2(gross - net);
    } else if (!gross && net > 0) {
        vat = vat || round2((net * rate) / 100);
        gross = round2(net + vat);
    } else if (net > 0 && gross > 0) {
        vat = round2(gross - net);
    }
    return { net: round2(net), vat: round2(Math.max(0, vat)), gross: round2(Math.max(gross, net + vat)) };
}

/** Одна строка экспорта; порядок значений совпадает с EXPENSE_EXPORT_COLUMNS. */
export function expenseExportRow(e: ExpenseExportSource, entries: ExpenseCatalogEntry[]): Array<string | number> {
    const leaf = catalogEntry(e.subcategory, entries);
    const bookable = leaf && !leaf.isGroup ? leaf : null;
    const group = catalogEntry(e.categoryCode, entries);
    const chart = e.datevChart === "SKR04" ? "SKR04" : "SKR03";
    const account = String(e.datevAccount ?? "").trim();
    const skr03 = chart === "SKR03" && account ? account : bookable?.datevSkr03 ?? "";
    const skr04 = chart === "SKR04" && account ? account : bookable?.datevSkr04 ?? "";
    const { net, vat, gross } = exportAmounts(e);
    const confidence = Math.round((Number(e.confidence) || 0) * 100);
    return [
        e.date || "",
        e.documentNumber || "",
        "",
        e.vendor || "",
        e.vendorVatId || "",
        e.vendorIban || "",
        e.categoryCode || bookable?.parentCode || "",
        // Kategorie — верхний уровень справочника, Unterkategorie — конкретный счёт DATEV
        group?.nameDe || e.category || bookable?.nameDe || "",
        bookable?.code || e.subcategory || "",
        bookable?.nameDe || e.subcategory || "",
        skr03,
        skr04,
        net,
        Number(e.taxRate) || 0,
        vat,
        gross,
        e.inputVatDeductible === false ? "nein" : "ja",
        e.bookingKind || "Betriebsausgabe",
        e.afaYears == null ? "" : e.afaYears,
        e.afaResidualValue == null ? "" : e.afaResidualValue,
        e.folder || "",
        e.paidDate || "",
        e.reviewStatus || "REVIEW",
        confidence,
        e.currency || "",
        e.notes || "",
    ];
}

export function expenseExportRows(list: ExpenseExportSource[], entries: ExpenseCatalogEntry[]): Array<Array<string | number>> {
    return list.map((e) => expenseExportRow(e, entries));
}
