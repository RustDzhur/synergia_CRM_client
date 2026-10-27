// Экспорт расходов для бухгалтера: колонки в порядке/именах, привычных DATEV-импорту
// (Belegdatum, Belegfeld, Konto SKR03/04, Netto/USt/Brutto, Buchungsart, AfA…). Чистая функция:
// маршрут только выбирает строки из базы, поэтому колонки и суммы проверяются тестом.
//
// Правила ELSTER (см. burokratie-copilot/docs/ELSTER_MAPPING.md, разделы 5–6):
//   * Kleinunternehmer (§19 UStG): в EÜR попадает brutto — Netto = Brutto, USt = 0, USt-Satz = 0;
//   * EÜR-Zeile/EÜR-Kz берутся из lib/finance/elsterMapping.ts (сгенерирован из ELSTER_CATEGORIES.csv);
//     неизвестный код → пустые значения + предупреждение в summary;
//   * Bewirtung: 70 % abziehbar / 30 % nicht abziehbar (две колонки, строки 63 / Kz 165+175);
//   * fahrzeug.privatnutzung и bookingKind=Privatentnahme/Einnahme — не расход: отдельный блок
//     «Einnahmen/Privat» (строка 20 или 106), чтобы выгрузка расходов не завышала Betriebsausgaben;
//   * Soll-/Ist-Versteuerung: Zahlungsdatum заполняется только при IST.
import { catalogEntry, type ExpenseCatalogEntry } from "./expenseCatalog";
import { elsterMappingFor, type ElsterMappingEntry } from "./elsterMapping";
import { toCsv } from "@/lib/import/csv";

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
    // Новые колонки добавлены в конец: порядок прежних (и импорт у бухгалтера) не сдвигается
    "EÜR-Zeile",
    "EÜR-Kz",
    "Bewirtung abziehbar (70 %)",
    "Bewirtung nicht abziehbar (30 %)",
] as const;

// Блок «Einnahmen/Privat»: приватные траты и доходные записи не участвуют в сумме расходов,
// поэтому у них своя небольшая таблица с суммой и EÜR-строкой (20 — частное использование Kfz,
// 106 — Entnahmen). Этот блок идёт отдельной секцией после расходов.
export const PRIVAT_EXPORT_COLUMNS = [
    "Belegdatum",
    "Belegfeld 1",
    "Lieferant",
    "Kategorie-Code",
    "Kategorie",
    "Betrag (Brutto)",
    "EÜR-Zeile",
    "EÜR-Kz",
    "Buchungsart",
    "Notizen",
] as const;

/** Soll- oder Ist-Versteuerung: при IST дата оплаты — расчётная дата, при SOLL не заполняется. */
export type SollIst = "SOLL" | "IST";

export interface ExpenseExportOptions {
    /** §19 UStG: EÜR brutto, без USt и Vorsteuer. */
    kleinunternehmer?: boolean;
    /** По умолчанию SOLL — как в настройках фирмы. */
    sollIst?: SollIst;
    /** Wirtschaftsjahr для summary/имени файла; на фильтрацию строк не влияет. */
    wirtschaftsjahr?: number;
}

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

export interface ExpenseExportSummary {
    kleinunternehmer: boolean;
    sollIst: SollIst;
    wirtschaftsjahr: number;
    /** Строк в блоке расходов. */
    rows: number;
    /** Строк в блоке «Einnahmen/Privat». */
    privatRows: number;
    /** Суммы по расходной части в терминах EÜR (при Kleinunternehmer — brutto). */
    totals: { net: number; vat: number; gross: number };
    /** Суммы по строкам EÜR: только строки с номером, по убыванию суммы. */
    euerLines: Array<{ line: string; amount: number }>;
    /** Что бухгалтер должен проверить перед сдачей (неизвестные коды, группы без подкатегории). */
    warnings: string[];
}

export interface ExpenseExportResult {
    columns: string[];
    rows: Array<Array<string | number>>;
    privat: { title: string; columns: string[]; rows: Array<Array<string | number>> };
    summary: ExpenseExportSummary;
}

/** Поведение по умолчанию совпадает с прежним экспортом: Regelbesteuerung, SOLL, текущий год. */
export function exportOptions(options: ExpenseExportOptions = {}): Required<ExpenseExportOptions> {
    const year = Number(options.wirtschaftsjahr);
    return {
        kleinunternehmer: options.kleinunternehmer === true,
        sollIst: options.sollIst === "IST" ? "IST" : "SOLL",
        wirtschaftsjahr: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : new Date().getFullYear(),
    };
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

/**
 * Суммы в терминах EÜR: обычная фирма показывает нетто (Vorsteuer отдельно, строка 57),
 * Kleinunternehmer — брутто (§19 UStG, без Vorsteuerabzug).
 */
export function exportTaxAmounts(e: ExpenseExportSource, options: ExpenseExportOptions = {}): { net: number; vat: number; gross: number; rate: number } {
    const opts = exportOptions(options);
    const { net, vat, gross } = exportAmounts(e);
    if (opts.kleinunternehmer) return { net: gross, vat: 0, gross, rate: 0 };
    return { net, vat, gross, rate: Number(e.taxRate) || 0 };
}

/** Строка EÜR с откатом на группу: сначала подкатегория, затем группа. */
function resolveElster(e: Pick<ExpenseExportSource, "subcategory" | "categoryCode">): { code: string; entry: ElsterMappingEntry | null } {
    const candidates = [String(e.subcategory ?? "").trim(), String(e.categoryCode ?? "").trim()].filter(Boolean);
    for (const code of candidates) {
        const entry = elsterMappingFor(code);
        if (entry) return { code, entry };
    }
    return { code: candidates[0] ?? "", entry: null };
}

const isBewirtung = (entry: ElsterMappingEntry | null, code: string): boolean =>
    entry?.source === "betriebsausgaben.bewirtung" || entry?.source === "bewirtung" || /bewirtung/i.test(code);

const INCOME_KINDS = new Set(["privatentnahme", "entnahme", "income", "einnahme", "einnahmen"]);
const PRIVAT_CODES = new Set(["fahrzeug.privatnutzung", "privatausgabe", "privat"]);

/**
 * Не расход: приватная трата/изъятие или доходная запись (Einnahme). Такие строки уходят
 * в блок «Einnahmen/Privat» и не попадают в Betriebsausgaben (строки 24–75 EÜR).
 */
export function isIncomeOrPrivate(e: Pick<ExpenseExportSource, "bookingKind" | "subcategory" | "categoryCode">): boolean {
    const kind = String(e.bookingKind ?? "").trim().toLowerCase();
    if (INCOME_KINDS.has(kind)) return true;
    return [String(e.subcategory ?? "").trim(), String(e.categoryCode ?? "").trim()].some(
        (code) => !!code && (PRIVAT_CODES.has(code) || code.startsWith("privatentnahme."))
    );
}

/** Одна строка экспорта; порядок значений совпадает с EXPENSE_EXPORT_COLUMNS. */
export function expenseExportRow(e: ExpenseExportSource, entries: ExpenseCatalogEntry[], options: ExpenseExportOptions = {}): Array<string | number> {
    const opts = exportOptions(options);
    const leaf = catalogEntry(e.subcategory, entries);
    const bookable = leaf && !leaf.isGroup ? leaf : null;
    const group = catalogEntry(e.categoryCode, entries);
    const chart = e.datevChart === "SKR04" ? "SKR04" : "SKR03";
    const account = String(e.datevAccount ?? "").trim();
    const skr03 = chart === "SKR03" && account ? account : bookable?.datevSkr03 ?? "";
    const skr04 = chart === "SKR04" && account ? account : bookable?.datevSkr04 ?? "";
    const { net, vat, gross, rate } = exportTaxAmounts(e, opts);
    const confidence = Math.round((Number(e.confidence) || 0) * 100);
    const { code, entry } = resolveElster(e);
    // Bewirtung: 70 % abziehbar (Kz 175), 30 % nicht abziehbar (Kz 165). База — нетто, если
    // Vorsteuer abziehbar (обычная фирма), иначе брутто (Kleinunternehmer): после §19 разделяем
    // ту сумму, которая реально попадает в EÜR.
    const bewirtung = isBewirtung(entry, code);
    const splitBase = opts.kleinunternehmer ? gross : net;
    const abziehbar = bewirtung ? round2(splitBase * 0.7) : "";
    const nichtAbziehbar = bewirtung ? round2(splitBase - round2(splitBase * 0.7)) : "";
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
        rate,
        vat,
        gross,
        // §19 UStG: Vorsteuer не вычитается независимо от отметки на документе
        opts.kleinunternehmer || e.inputVatDeductible === false ? "nein" : "ja",
        e.bookingKind || "Betriebsausgabe",
        e.afaYears == null ? "" : e.afaYears,
        e.afaResidualValue == null ? "" : e.afaResidualValue,
        e.folder || "",
        // Soll-Versteuerung: оплата не влияет на отчёт, дата оплаты остаётся пустой
        opts.sollIst === "IST" ? e.paidDate || "" : "",
        e.reviewStatus || "REVIEW",
        confidence,
        e.currency || "",
        e.notes || "",
        entry ? entry.euerLine : "",
        entry ? entry.euerKz : "",
        abziehbar,
        nichtAbziehbar,
    ];
}

/** Строка блока «Einnahmen/Privat»: сумма брутто и EÜR-строка (20 — Kfz-Privatnutzung, 106 — Entnahme). */
export function privatExportRow(e: ExpenseExportSource, entries: ExpenseCatalogEntry[]): Array<string | number> {
    const leaf = catalogEntry(e.subcategory, entries);
    const group = catalogEntry(e.categoryCode, entries);
    const { entry } = resolveElster(e);
    return [
        e.date || "",
        e.documentNumber || "",
        e.vendor || "",
        e.categoryCode || leaf?.parentCode || "",
        group?.nameDe || e.category || leaf?.nameDe || "",
        exportAmounts(e).gross,
        entry ? entry.euerLine : "",
        entry ? entry.euerKz : "",
        e.bookingKind || "Privatentnahme",
        e.notes || "",
    ];
}

export function expenseExportRows(list: ExpenseExportSource[], entries: ExpenseCatalogEntry[], options: ExpenseExportOptions = {}): Array<Array<string | number>> {
    return list.map((e) => expenseExportRow(e, entries, options));
}

/** Собирает блок расходов, блок «Einnahmen/Privat» и summary с предупреждениями. */
export function buildExpenseExport(list: ExpenseExportSource[], entries: ExpenseCatalogEntry[], options: ExpenseExportOptions = {}): ExpenseExportResult {
    const opts = exportOptions(options);
    const warnings = new Set<string>();
    const expenses: ExpenseExportSource[] = [];
    const privat: ExpenseExportSource[] = [];
    for (const e of list) {
        if (isIncomeOrPrivate(e)) {
            privat.push(e);
            continue;
        }
        expenses.push(e);
        const { code, entry } = resolveElster(e);
        if (!entry) {
            warnings.add(`Kategorie "${code || "—"}" hat keine EÜR-Zuordnung — EÜR-Zeile/Kz bleiben leer.`);
        } else if (entry.group) {
            warnings.add(`Kategorie "${code}" ist eine Sammelgruppe — Unterkategorie wählen, EÜR-Zeile/Kz bleiben leer.`);
        }
    }

    const rows = expenses.map((e) => expenseExportRow(e, entries, opts));
    const privatRows = privat.map((e) => privatExportRow(e, entries));

    let net = 0, vat = 0, gross = 0;
    const byLine = new Map<string, number>();
    for (const e of expenses) {
        const amounts = exportTaxAmounts(e, opts);
        net = round2(net + amounts.net);
        vat = round2(vat + amounts.vat);
        gross = round2(gross + amounts.gross);
        const { entry } = resolveElster(e);
        if (entry?.euerLine) byLine.set(entry.euerLine, round2((byLine.get(entry.euerLine) ?? 0) + amounts.net));
    }

    const lineOrder = (line: string) => {
        const first = Number(line.split(/[^\d]/)[0]);
        return Number.isFinite(first) ? first : 999;
    };

    return {
        columns: [...EXPENSE_EXPORT_COLUMNS],
        rows,
        privat: { title: "Einnahmen/Privat", columns: [...PRIVAT_EXPORT_COLUMNS], rows: privatRows },
        summary: {
            kleinunternehmer: opts.kleinunternehmer,
            sollIst: opts.sollIst,
            wirtschaftsjahr: opts.wirtschaftsjahr,
            rows: rows.length,
            privatRows: privatRows.length,
            totals: { net, vat, gross },
            euerLines: Array.from(byLine.entries()).map(([line, amount]) => ({ line, amount })).sort((a, b) => lineOrder(a.line) - lineOrder(b.line)),
            warnings: Array.from(warnings),
        },
    };
}

/**
 * CSV всей выгрузки: таблица расходов, затем — если есть строки — отдельный блок
 * «Einnahmen/Privat» со своим заголовком. Заголовок секции не превращается в объект при
 * JSON-выгрузке: там блок лежит отдельным полем `einnahmenPrivat`.
 */
export function expenseExportCsv(result: ExpenseExportResult): string {
    const expenses = toCsv(result.columns, result.rows);
    if (!result.privat.rows.length) return expenses;
    const privat = toCsv(result.privat.columns, result.privat.rows).replace(/^\uFEFF/, "");
    return `${expenses}\r\n${result.privat.title}\r\n${privat}`;
}
