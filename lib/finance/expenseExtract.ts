// Автоопределение полей расхода по тексту документа (PDF/OCR/письмо) и метаданным загрузки.
// Правила, а не модель: немецкие ключевые слова, суммы, ставки USt, USt-IdNr., IBAN, номера
// документов и справочник категорий DATEV. Модуль чистый (без базы и AI), поэтому его поведение
// закреплено тестами tests/expenseExtract.test.ts. Уверенность считается по найденным полям:
// чем меньше документ похож на счёт, тем ниже confidence и тем выше шанс статуса REVIEW.
import {
    EXPENSE_CATEGORY_CATALOG,
    catalogEntry,
    catalogGroup,
    datevAccountFor,
    folderForCategory,
    resolveSubcategoryCode,
    type DatevChart,
    type ExpenseBookingKind,
    type ExpenseCatalogEntry,
    type ExpenseReviewStatus,
} from "./expenseCatalog";
import { normalizeAmounts, type DetectedFields, type ExpenseProposal, type ProposalField } from "./expenseTax";

export interface ExpenseExtractMeta {
    vendor?: string;
    /** Общая сумма с чека; если не указаны net/gross — считается брутто. */
    amount?: number;
    netAmount?: number;
    grossAmount?: number;
    vatAmount?: number;
    taxRate?: number;
    currency?: string;
    date?: string;
    paidDate?: string;
    documentNumber?: string;
    vendorVatId?: string;
    vendorIban?: string;
    category?: string;
    subcategory?: string;
}

export interface ExpenseExtractInput {
    text?: string;
    meta?: ExpenseExtractMeta;
    /** Справочник из базы; по умолчанию встроенный каталог. */
    categories?: ExpenseCatalogEntry[];
    chart?: DatevChart;
    /** Ставка страны/фирмы — применяется, только если в документе есть слово USt/MwSt без числа. */
    defaultRate?: number;
    /** Сегодняшняя дата — для папки Belege/<год>, если дата документа не найдена. */
    today?: string;
    /** Уже сохранённый поставщик: используется, только если он есть в тексте. */
    vendorHint?: string;
}

export interface ExpenseWarning {
    code: string;
    message: string;
}

export interface ExpenseExtraction {
    fields: ExpenseProposal;
    detected: DetectedFields;
    confidence: number;
    confidenceByField: Partial<Record<ProposalField, number>>;
    reviewStatus: ExpenseReviewStatus;
    evidence: string[];
    warnings: ExpenseWarning[];
    /** Лучшая найденная категория — интерфейсу нужны название и счёт для подсказки. */
    category: { code: string; parentCode: string; nameDe: string; nameEn: string; account: string } | null;
}

// ── текстовые утилиты ────────────────────────────────────────────────────────────────────────────────

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Свёртка для поиска: регистр, умлауты, мягкие переносы и неразрывные пробелы не должны мешать. */
export function foldText(value: string): string {
    return String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\u00ad/g, "")
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[’‘`]/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Поиск ключевого слова: короткие — только целым словом, длинные — подстрокой (немецкие сложные слова). */
function occurrences(haystack: string, keyword: string): number {
    const kw = foldText(keyword);
    if (!kw) return 0;
    if (kw.length <= 4 || !kw.includes(" ")) {
        const re = new RegExp(`(^|[^a-z0-9])${escapeRe(kw)}([^a-z0-9]|$)`, "g");
        return Math.min(3, (haystack.match(re) ?? []).length);
    }
    let count = 0;
    let from = 0;
    while (count < 3) {
        const at = haystack.indexOf(kw, from);
        if (at === -1) break;
        count++;
        from = at + kw.length;
    }
    return count;
}

const stripLine = (line: string) => line.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();

// ── суммы ────────────────────────────────────────────────────────────────────────────────────────────

const MONEY_LABELS_GROSS = [
    "brutto", "gesamtbetrag", "gesamtpreis", "gesamt", "rechnungsbetrag", "endbetrag", "zahlbetrag",
    "zu zahlen", "zahlungsbetrag", "total", "summe", "betrag", "invoice total", "amount due", "grand total",
];
const MONEY_LABELS_NET = ["netto", "nettobetrag", "netto-summe", "nettosumme", "warenwert", "subtotal", "zwischensumme"];
const MONEY_LABELS_VAT = ["ust", "mwst", "mehrwertsteuer", "umsatzsteuer", "vat", "tax", "steuerbetrag"];

const hasAny = (hay: string, needles: string[]) => needles.some((n) => hay.includes(n));

/** Сумма из немецкой/английской записи: 1.234,56 / 1,234.56 / 1 234,56 / 49,99 / 49.99. */
export function parseAmount(raw: string): number | null {
    let s = String(raw ?? "").replace(/[\s\u00a0]/g, "");
    if (!s) return null;
    if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(s)) {
        // 1,234.56 — английская запись: запятые — тысячи
        s = s.replace(/,/g, "");
    } else if (/,\d{1,2}$/.test(s)) {
        // 1.234,56 — немецкая запись: точка — тысячи
        s = s.replace(/\./g, "").replace(",", ".");
    } else if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) {
        s = s.replace(/\./g, "");
    } else {
        s = s.replace(/,/g, "");
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 && n < 1_000_000_000 ? round2(n) : null;
}

interface AmountCandidate {
    value: number;
    raw: string;
    index: number;
    lineIndex: number;
    line: string;
    before: string;
    after: string;
    currency: boolean;
}

const MONEY_TOKEN = /(?<![\w.,])(\d{1,3}(?:[ .]\d{3})+(?:,\d{1,2})?|\d+,\d{1,2}|\d{1,3}(?:,\d{3})+\.\d{1,2}|\d+\.\d{1,2}|\d+)(?![\w])/g;

/** Кандидаты в суммы с контекстом строки. Даты, годы, USt-IdNr. и номера отсеиваются здесь же. */
export function collectAmounts(text: string): AmountCandidate[] {
    const out: AmountCandidate[] = [];
    const lines = String(text ?? "").split(/\r?\n/);
    let offset = 0;
    for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        const re = new RegExp(MONEY_TOKEN.source, "g");
        let m: RegExpExecArray | null;
        while ((m = re.exec(line))) {
            const raw = m[1];
            const idx = offset + m.index;
            const beforeRaw = line.slice(0, m.index);
            const afterRaw = line.slice(m.index + raw.length);
            // Дата 03.10.2026: 03.10 — не сумма
            if (/^\d{1,2}\.\d{1,2}$/.test(raw) && /^\s*[.\/-]\s*\d{2,4}/.test(afterRaw)) continue;
            // USt-IdNr / IBAN / телефон: кандидат приклеен к буквам/цифрам
            if (/[A-Za-z0-9-]$/.test(beforeRaw)) continue;
            const hasComma = raw.includes(",");
            const hasDotDecimals = /\.\d{1,2}$/.test(raw) && !/^\d{1,3}(?:\.\d{3})+$/.test(raw);
            const hasCurrency = /(€|eur|euro|\$|usd|chf|gbp|£|uah|грн)/i.test(`${beforeRaw.slice(-8)} ${afterRaw.slice(0, 8)}`);
            const integer = /^\d+$/.test(raw);
            const lineHasLabel = labelKind(line) !== null;
            if (!hasComma && !hasDotDecimals && !hasCurrency && !(integer && lineHasLabel)) continue;
            if (integer && !lineHasLabel && raw.length === 4 && Number(raw) >= 1900 && Number(raw) <= 2100) continue;
            const value = parseAmount(raw);
            if (value == null) continue;
            out.push({ value, raw, index: idx, lineIndex: li, line, before: beforeRaw, after: afterRaw, currency: hasCurrency });
        }
        offset += line.length + 1;
    }
    return out;
}

function labelKind(line: string): "gross" | "net" | "vat" | null {
    const hay = foldText(line);
    if (hay.includes("ust-id") || hay.includes("ust id") || hay.includes("ustid") || hay.includes("umsatzsteuer-id")) return null;
    if (hasAny(hay, MONEY_LABELS_VAT)) return "vat";
    if (hasAny(hay, MONEY_LABELS_NET)) return "net";
    if (hasAny(hay, MONEY_LABELS_GROSS)) return "gross";
    return null;
}

interface AmountsFound {
    net: number | null;
    gross: number | null;
    vat: number | null;
    rate: number | null;
    rateExplicit: boolean;
    mixedRates: boolean;
    rateMismatch: boolean;
    evidence: string[];
    warning?: string;
}

const RATE_RE = /(?<![\d.,])(\d{1,2}(?:[.,]\d{1,2})?)\s*%(?!\d)/g;

/** Ставки USt из текста: только рядом со словами USt/MwSt/Steuer, чтобы не поймать скидку 10 %. */
export function collectVatRates(text: string): Array<{ rate: number; index: number; amount: number | null }> {
    const out: Array<{ rate: number; index: number; amount: number | null }> = [];
    const lines = String(text ?? "").split(/\r?\n/);
    let offset = 0;
    for (const line of lines) {
        const hay = foldText(line);
        const vatLine = hasAny(hay, MONEY_LABELS_VAT) || hay.includes("inkl. mwst") || hay.includes("zzgl. ust") || hay.includes("inkl. ust");
        if (!vatLine) {
            offset += line.length + 1;
            continue;
        }
        const re = new RegExp(RATE_RE.source, "g");
        let m: RegExpExecArray | null;
        while ((m = re.exec(line))) {
            const rate = Number(m[1].replace(",", "."));
            if (!Number.isFinite(rate) || rate < 0 || rate > 30) continue;
            const after = line.slice(m.index + m[0].length);
            const amountMatch = after.match(/(\d{1,3}(?:[ .]\d{3})*,\d{1,2}|\d+\.\d{1,2}|\d+)/);
            const amount = amountMatch ? parseAmount(amountMatch[1]) : null;
            out.push({ rate: round2(rate), index: offset + m.index, amount });
        }
        offset += line.length + 1;
    }
    return out;
}

function pickRate(rates: ReturnType<typeof collectVatRates>): { rate: number | null; mixed: boolean } {
    if (!rates.length) return { rate: null, mixed: false };
    const unique = Array.from(new Set(rates.map((r) => r.rate)));
    if (unique.length === 1) return { rate: unique[0], mixed: false };
    // Несколько ставок: побеждает та, рядом с которой напечатана большая сумма налога
    const byRate = new Map<number, number>();
    for (const r of rates) byRate.set(r.rate, (byRate.get(r.rate) ?? 0) + (r.amount ?? 0));
    const best = Array.from(byRate.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    return { rate: best?.[0] ?? null, mixed: true };
}

const KLEINUNTERNEHMER = /(?:§\s*19|kleinunternehmer|kleinunternehmerregelung|ohne\s+vorsteuer|kein\s+vorsteuerabzug|vorsteuer\s+nicht\s+abziehbar|nicht\s+abzugsf)/i;
const REVERSE_CHARGE = /(?:reverse[\s-]?charge|§\s*13b|steuerschuldnerschaft\s+des\s+leistungsempfaengers|steuerschuldnerschaft\s+des\s+leistungsempfängers)/i;

/** Учётные суммы: netto/brutto/USt и ставка. Раздельные правила помечены в evidence. */
function findAmounts(text: string, meta: ExpenseExtractMeta | undefined, defaultRate: number | undefined, fallbackRate: number | null): AmountsFound {
    const evidence: string[] = [];
    const candidates = collectAmounts(text);
    const rates = collectVatRates(text);
    const picked = pickRate(rates);

    let net = meta?.netAmount != null ? Number(meta.netAmount) : null;
    let gross = meta?.grossAmount != null ? Number(meta.grossAmount) : meta?.amount != null && meta.netAmount == null ? Number(meta.amount) : null;
    let vat = meta?.vatAmount != null ? Number(meta.vatAmount) : null;
    let rate: number | null = meta?.taxRate != null ? Number(meta.taxRate) : picked.rate ?? fallbackRate;
    let rateExplicit = meta?.taxRate != null || picked.rate != null;
    let mixedRates = picked.mixed;

    // Явные подписи в тексте. Если сумма одна и она подписана «Gesamtbetrag», это брутто.
    const byKind: Record<"gross" | "net" | "vat", AmountCandidate[]> = { gross: [], net: [], vat: [] };
    for (const c of candidates) {
        // Ставка «19 %» — не сумма: иначе у чека на 5 € ставка 19 перебила бы брутто
        if (/^\s*%/.test(c.after)) continue;
        const lastLine = c.lineIndex > 0 ? text.split(/\r?\n/)[c.lineIndex - 1] ?? "" : "";
        const kind = labelKind(c.before) ?? labelKind(c.line) ?? (labelKind(c.after) && !/\d/.test(c.after) ? labelKind(c.after) : null) ?? (/^\s*[\d.,\s€]*$/.test(c.line) ? labelKind(lastLine) : null);
        if (kind) byKind[kind].push(c);
    }

    if (net == null && byKind.net.length) {
        net = byKind.net[0].value;
        evidence.push(`Netto: ${byKind.net[0].raw} €`);
    }
    if (vat == null && byKind.vat.length) {
        // Из строки «USt 19 % 12,34» берём именно сумму, а не ставку: ставка стоит перед «%»
        const vatCandidate = byKind.vat.find((c) => !/^\s*%/.test(c.after) && c.value <= 100_000) ?? byKind.vat.find((c) => !/^\s*%/.test(c.after)) ?? byKind.vat[0];
        vat = vatCandidate.value;
        evidence.push(`USt: ${vatCandidate.raw} €`);
    }
    if (gross == null) {
        if (byKind.gross.length) {
            const best = byKind.gross.slice().sort((a, b) => b.value - a.value)[0];
            gross = best.value;
            evidence.push(`Brutto: ${best.raw} €`);
        } else if (net == null && vat == null && candidates.length) {
            // Без подписей: самая крупная сумма — обычно итог
            const best = candidates.slice().sort((a, b) => b.value - a.value)[0];
            gross = best.value;
            evidence.push(`Gesamtbetrag erkannt: ${best.raw} €`);
        }
    }

    // Ставка: если есть netto и сумма налога, арифметика документа важнее напечатанного числа
    let derivedRate: number | null = null;
    if (net != null && vat != null && net > 0) derivedRate = round2((vat / net) * 100);
    if (rate == null && derivedRate != null) {
        rate = derivedRate;
        rateExplicit = derivedRate > 0;
    }
    const rateMismatch = rate != null && derivedRate != null && Math.abs(rate - derivedRate) > 1.5;
    if (rateMismatch) rate = derivedRate;

    // Слова USt/MwSt без числа — применяем ставку фирмы/страны
    const mentionsVat = /(?:mwst|mehrwertsteuer|umsatzsteuer|inkl\.?\s*ust|zzgl\.?\s*ust|\bust\b)/i.test(text);
    if (rate == null && mentionsVat && defaultRate != null && defaultRate > 0) {
        rate = defaultRate;
        evidence.push(`USt-Satz aus Einstellungen: ${defaultRate} %`);
    }
    if (rate == null) rate = 0;
    // 0 % при Kleinunternehmer/Reverse Charge: не подставляем 19 % из настроек
    if (KLEINUNTERNEHMER.test(text) || REVERSE_CHARGE.test(text)) {
        rate = 0;
        rateExplicit = true;
    }
    // Ставки 19/7/0 в документах печатают с запятой; приводим 19.0 к 19
    rate = round2(rate);

    return { net, gross, vat, rate, rateExplicit, mixedRates, rateMismatch, evidence };
}

// ── даты, номер, реквизиты ──────────────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
    januar: 1, februar: 2, "märz": 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8,
    september: 9, oktober: 10, november: 11, dezember: 12,
    january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, october: 10, december: 12,
    январь: 1, февраля: 2, март: 3, апреля: 4, мая: 5, июня: 6, июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
};

const isoDate = (y: number, m: number, d: number): string => {
    if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return "";
    return date.toISOString().slice(0, 10);
};

/** Дата из немецкого 03.10.2026, ISO 2026-10-03, 03/10/2026 (US-порядок распознаём по второму числу > 12). */
export function parseDateText(raw: string): string {
    const s = String(raw ?? "").trim();
    let m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})$/);
    if (m) {
        let d = Number(m[1]);
        let mo = Number(m[2]);
        const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
        if (mo > 12 && d <= 12) [d, mo] = [mo, d];
        return isoDate(y, mo, d);
    }
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
    m = s.match(/^(\d{1,2})\.?\s*([A-Za-zÄÖÜäöüßА-Яа-я]+)\.?\s+(\d{4})$/);
    if (m) {
        const month = MONTHS[m[2].toLowerCase()];
        if (month) return isoDate(Number(m[3]), month, Number(m[1]));
    }
    m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
    if (m) {
        const month = MONTHS[m[1].toLowerCase()];
        if (month) return isoDate(Number(m[3]), month, Number(m[2]));
    }
    return "";
}

const DATE_TOKEN = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\.?\s*(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)[a-zäöü]*\.?\s+\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i;

function findDate(text: string, labels: RegExp, allowFirst = true): { value: string; evidence: string; confidence: number } | null {
    const labelled = labels.exec(text);
    if (labelled) {
        const window = text.slice(labelled.index, labelled.index + 120);
        const token = window.match(DATE_TOKEN);
        if (token) {
            const value = parseDateText(token[1]);
            if (value) return { value, evidence: `${labelled[0].trim()}: ${value}`, confidence: 0.9 };
        }
    }
    if (allowFirst) {
        const token = text.match(DATE_TOKEN);
        if (token) {
            const value = parseDateText(token[1]);
            if (value) return { value, evidence: `Datum im Dokument: ${value}`, confidence: 0.6 };
        }
    }
    return null;
}

const DOCUMENT_DATE_LABELS = /(?:rechnungsdatum|belegdatum|ausstellungsdatum|rechnung\s+vom|datum\s+der\s+rechnung|invoice\s+date|invoice\s+dated|date\s+of\s+invoice|datum)\s*[:.]?/i;
const PAID_DATE_LABELS = /(?:zahlungsdatum|bezahlt\s+am|gezahlt\s+am|payment\s+date|paid\s+on|valuta)\s*[:.]?/i;

const DOC_NUMBER_RE = /(?:rechnungs?\s*(?:nummer|nr\.?|-?nr\.?)|beleg\s*(?:nummer|nr\.?|-?nr\.?)|bon\s*(?:nummer|nr\.?)|quittung\s*(?:snummer|nr\.?)?|kassenbon\s*(?:nr\.?)?|invoice\s*(?:no\.?|number|#)|inv\.?\s*(?:-?nr\.?|no\.?)|rg\.?\s*(?:-?nr\.?|no\.?)|rechnung\s*nr\.?)\s*[:.#-]?\s*([A-Za-z0-9][A-Za-z0-9._/#-]{1,30})/i;
const DOC_NUMBER_FALLBACK = /\b(?:RE|RG|INV|RECH|BELEG|BON)[-_ ]?\d{2,4}[-/]?\d{1,6}\b/i;

function cleanDocNumber(raw: string): string {
    const value = raw.replace(/[.,;:]+$/, "");
    if (!value) return "";
    if (/^\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}$/.test(value)) return "";
    if (/^(?:19|20)\d{2}$/.test(value)) return "";
    if (/^[A-Z]{2}\d{9}$/.test(value)) return "";
    return value.slice(0, 40);
}

function findDocumentNumber(text: string): { value: string; confidence: number; evidence: string } | null {
    const labelled = DOC_NUMBER_RE.exec(text);
    if (labelled) {
        const value = cleanDocNumber(labelled[1]);
        if (value) return { value, confidence: 0.85, evidence: `Belegnummer: ${value}` };
    }
    const fallback = DOC_NUMBER_FALLBACK.exec(text);
    if (fallback) {
        const value = cleanDocNumber(fallback[0]);
        if (value) return { value, confidence: 0.65, evidence: `Belegnummer: ${value}` };
    }
    return null;
}

const VAT_ID_RE = /(?:ust[-\s]?id(?:nr\.?|nummer)?|umsatzsteuer[-\s]?identifikationsnummer|vat[-\s]?(?:id|no\.?|number)|uid)\s*[:.-]?\s*([A-Z]{2}\s?[A-Z0-9](?:[A-Z0-9 ]{6,16}))/i;
const VAT_ID_FALLBACK = /\b(DE\s?\d{3}\s?\d{3}\s?\d{3})\b/;
const IBAN_RE = /\bIBAN\b\s*[:.-]?\s*([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{0,4})?)/i;
const IBAN_FALLBACK = /\b([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?)\b/;

function normalizeVatId(raw: string): string {
    const value = raw.replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{2}[A-Z0-9]{6,14}$/.test(value)) return "";
    if (value.startsWith("DE") && !/^DE\d{9}$/.test(value)) return "";
    return value;
}

function validIbanStructure(raw: string): boolean {
    const value = raw.replace(/\s+/g, "").toUpperCase();
    return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value) && value.length >= 15 && value.length <= 34;
}

function ibanChecksumOk(iban: string): boolean {
    const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
    const digits = Array.from(rearranged, (c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c)).join("");
    const mod = digits.split("").reduce((acc, ch) => (acc * 10 + Number(ch)) % 97, 0);
    return mod === 1;
}

function findVatId(text: string): string {
    const labeled = VAT_ID_RE.exec(text);
    const fromLabel = labeled ? normalizeVatId(labeled[1]) : "";
    if (fromLabel) return fromLabel;
    const fallback = VAT_ID_FALLBACK.exec(text);
    return fallback ? normalizeVatId(fallback[1]) : "";
}

function findIban(text: string): { value: string; checksum: boolean } | null {
    const labeled = IBAN_RE.exec(text);
    const raw = labeled ? labeled[1] : IBAN_FALLBACK.exec(text)?.[1];
    if (!raw || !validIbanStructure(raw)) return null;
    const value = raw.replace(/\s+/g, "").toUpperCase();
    return { value, checksum: ibanChecksumOk(value) };
}

// ── поставщик и категория ────────────────────────────────────────────────────────────────────────────

const VENDOR_LABEL_RE = /(?:lieferant|verkäufer|verkaeufer|rechnungssteller|aussteller|absender|anbieter|supplier|vendor|seller|von)\s*[:\-]\s*(.{2,100})/i;
const COMPANY_SUFFIX_RE = /(gmbh|ag|kg|ug|ohg|gbr|e\.\s?k\.?|ltd|inc|llc|se)\b/i;

function cleanVendor(raw: string): string {
    return raw
        .replace(/[|;].*$/, "")
        .replace(/\s{2,}.*$/, " ")
        .replace(/\s+/g, " ")
        .replace(/[.,;:]+$/, "")
        .trim()
        .slice(0, 120);
}

function knownVendorMatch(text: string, categories: ExpenseCatalogEntry[]): string {
    const hay = foldText(text);
    const names = new Set<string>();
    for (const entry of categories) for (const vendor of entry.vendors ?? []) if (vendor) names.add(vendor);
    let best = "";
    for (const name of Array.from(names)) {
        const folded = foldText(name);
        // Короткие имена (Meta, UPS, O2) — только целым словом, иначе «Metadaten» станет поставщиком Meta
        if (folded.length >= 3 && occurrences(hay, folded) > 0 && folded.length > foldText(best).length) best = name;
    }
    return best;
}

function findVendor(text: string, meta: ExpenseExtractMeta | undefined, categories: ExpenseCatalogEntry[], hint?: string): { value: string; confidence: number; evidence: string } | null {
    if (meta?.vendor && String(meta.vendor).trim()) {
        return { value: cleanVendor(String(meta.vendor)), confidence: 0.95, evidence: "Lieferant aus Metadaten" };
    }
    const known = knownVendorMatch(text, categories);
    if (known) return { value: known, confidence: 0.8, evidence: `Lieferant erkannt: ${known}` };
    const labeled = VENDOR_LABEL_RE.exec(text);
    if (labeled) {
        const value = cleanVendor(labeled[1]);
        if (value && !/rechnung|beleg|betrag|datum|kunde/i.test(value)) return { value, confidence: 0.65, evidence: `Lieferant: ${value}` };
    }
    // Название фирмы с юридической формой в первых строках — обычная шапка счёта
    for (const line of text.split(/\r?\n/).slice(0, 8)) {
        const clean = stripLine(line);
        if (clean.length < 3 || clean.length > 100) continue;
        if (/\brechnung|beleg|kunde|ust-id|\bust\b|umsatzsteuer|datum|seite|betrag/i.test(clean)) continue;
        if (COMPANY_SUFFIX_RE.test(clean)) return { value: cleanVendor(clean), confidence: 0.5, evidence: `Lieferant: ${cleanVendor(clean)}` };
    }
    if (hint && hint.trim() && foldText(text).includes(foldText(hint))) return { value: cleanVendor(hint), confidence: 0.55, evidence: "Lieferant aus dem gespeicherten Datensatz" };
    return null;
}

export interface CategoryMatch {
    leaf: ExpenseCatalogEntry;
    group: ExpenseCatalogEntry | null;
    score: number;
    confidence: number;
    evidence: string[];
    vendorHit: boolean;
}

/** Классификатор: взвешенные попадания ключевых слов и известных поставщиков; ничья — порядок справочника. */
export function classifyExpense(text: string, vendor: string, categories: ExpenseCatalogEntry[] = EXPENSE_CATEGORY_CATALOG): CategoryMatch {
    const hay = foldText(text);
    const vendorHay = foldText(vendor);
    let best: ExpenseCatalogEntry | null = null;
    let bestScore = 0;
    let bestKeywords: string[] = [];
    let bestVendor = false;

    for (const entry of categories) {
        if (entry.isGroup) continue;
        let score = 0;
        const hits: string[] = [];
        for (const keyword of entry.keywords ?? []) {
            const count = occurrences(hay, keyword);
            if (!count) continue;
            const weight = 1 + Math.min(foldText(keyword).length / 10, 1.5) + (keyword.includes(" ") ? 0.5 : 0);
            score += weight * count;
            hits.push(keyword);
        }
        let vendorHit = false;
        if (vendorHay) {
            for (const v of entry.vendors ?? []) {
                const folded = foldText(v);
                if (folded.length >= 3 && (occurrences(vendorHay, folded) > 0 || occurrences(hay, folded) > 0)) {
                    score += 6;
                    vendorHit = true;
                    hits.push(v);
                    break;
                }
            }
        }
        const nameHit = hay.includes(foldText(entry.nameDe));
        if (nameHit) score += 2.5;
        if (score > bestScore) {
            best = entry;
            bestScore = score;
            bestKeywords = hits.slice(0, 3);
            bestVendor = vendorHit;
        }
    }

    if (!best || bestScore < 1.4) {
        const fallback = catalogEntry("sonstiges_allgemein", categories) ?? catalogEntry("sonstiges", categories);
        const leaf = fallback && !fallback.isGroup ? fallback : (categories.find((e) => !e.isGroup) ?? EXPENSE_CATEGORY_CATALOG.find((e) => !e.isGroup)!);
        return {
            leaf,
            group: catalogGroup(leaf.code, categories),
            score: 0,
            confidence: hay.length > 20 ? 0.2 : 0,
            evidence: hay.length > 20 ? ["Keine sichere Kategorie — Sonstiges"] : [],
            vendorHit: false,
        };
    }
    const confidence = clamp(0.25 + Math.min(0.45, bestScore / 14) + (bestVendor ? 0.18 : 0) + (hay.includes(foldText(best.nameDe)) ? 0.08 : 0), 0.3, 0.95);
    return {
        leaf: best,
        group: catalogGroup(best.code, categories),
        score: bestScore,
        confidence: round2(confidence),
        evidence: bestKeywords.map((k) => `Kategorie: ${k}`),
        vendorHit: bestVendor,
    };
}

// ── сборка результата ──────────────────────────────────────────────────────────────────────────────

const CURRENCY_HINTS: Array<{ code: string; re: RegExp }> = [
    { code: "EUR", re: /(€|\beur\b|\beuro\b)/i },
    { code: "USD", re: /(\$|\busd\b|\bdollar\b)/i },
    { code: "CHF", re: /\bchf\b/i },
    { code: "GBP", re: /(£|\bgbp\b)/i },
    { code: "UAH", re: /(₴|\buah\b|\bгрн\b)/i },
];

function detectCurrency(text: string, meta?: ExpenseExtractMeta): string {
    if (meta?.currency && /^[A-Za-z]{3,6}$/.test(meta.currency)) return meta.currency.toUpperCase();
    for (const hint of CURRENCY_HINTS) if (hint.re.test(text)) return hint.code;
    return "";
}

const BOOKING_PRIVATE = /(?:privatentnahme|private\s+withdrawal|privatkauf|privat\s+ausgegeben|für\s+privat|fuer\s+privat)/i;
const BOOKING_INVEST = /(?:investition|anschaffung|aktivierung|anlagegut|abschreibung|\bafa\b|nutzungsdauer)/i;

function findBookingKind(text: string, leaf: ExpenseCatalogEntry | null): { kind: ExpenseBookingKind; evidence: string; explicit: boolean } {
    if (BOOKING_PRIVATE.test(text)) return { kind: "Privatentnahme", evidence: "Buchungsart: Privatentnahme", explicit: true };
    if (BOOKING_INVEST.test(text)) return { kind: "Investition", evidence: "Buchungsart: Investition", explicit: true };
    if (leaf?.bookingKind) return { kind: leaf.bookingKind, evidence: `Buchungsart aus Kategorie: ${leaf.bookingKind}`, explicit: false };
    return { kind: "Betriebsausgabe", evidence: "Buchungsart: Betriebsausgabe", explicit: false };
}

function findAfaYears(text: string, leaf: ExpenseCatalogEntry | null): { years: number | null; residual: number | null; evidence: string } {
    const m = text.match(/(?:nutzungsdauer|abschreibungsdauer|\bafa\b|abschreibung)\D{0,24}(\d{1,2})\s*(?:jahre|jahren|a\b)/i);
    const years = m ? clamp(Number(m[1]), 1, 100) : leaf?.afaYears ?? null;
    const residualMatch = text.match(/(?:restwert|restbuchwert)\D{0,12}([\d.,]+)/i);
    const residual = residualMatch ? parseAmount(residualMatch[1]) : null;
    return { years, residual, evidence: years ? `AfA: ${years} Jahre` : "" };
}

function findSalutation(text: string): boolean {
    // Не «Betreff: Rechnung» и не «Kundennummer» — только явные слова про право на вычет
    return KLEINUNTERNEHMER.test(text) || /(?:ohne\s+ust|ohne\s+umsatzsteuer|zzgl\.?\s+keine\s+ust)/i.test(text);
}

/** Главная функция: текст/метаданные → предложение полей + уверенность + предупреждения. */
export function extractExpenseFields(input: ExpenseExtractInput): ExpenseExtraction {
    const text = String(input.text ?? "");
    const meta = input.meta ?? {};
    const categories = input.categories?.length ? input.categories : EXPENSE_CATEGORY_CATALOG;
    const chart: DatevChart = input.chart === "SKR04" ? "SKR04" : "SKR03";
    const evidence: string[] = [];
    const warnings: ExpenseWarning[] = [];
    const confidenceByField: Partial<Record<ProposalField, number>> = {};
    const fields: ExpenseProposal = {
        vendor: "", documentNumber: "", documentDate: "", paidDate: "", currency: "",
        netAmount: 0, grossAmount: 0, vatAmount: 0, taxRate: 0, inputVatDeductible: true,
        category: "", categoryCode: "", subcategory: "", datevAccount: "", datevChart: chart,
        bookingKind: "Betriebsausgabe", afaYears: null, afaResidualValue: null, folder: "",
        vendorVatId: "", vendorIban: "",
    };
    const detected: DetectedFields = [];

    // Поставщик — до категории: известные поставщики дают вес категории
    const vendor = findVendor(text, meta, categories, input.vendorHint);
    if (vendor) {
        fields.vendor = vendor.value;
        confidenceByField.vendor = vendor.confidence;
        evidence.push(vendor.evidence);
    }

    // Категория: явная подсказка из метаданных (OCR/AI уже выбрал код или название) важнее
    // текстового классификатора; иначе — взвешенные ключевые слова и известные поставщики.
    const metaLeafCode = meta.subcategory ? resolveSubcategoryCode(meta.subcategory, categories) : meta.category ? resolveSubcategoryCode(meta.category, categories) : "";
    const metaLeaf = metaLeafCode ? catalogEntry(metaLeafCode, categories) : null;
    const match = metaLeaf && !metaLeaf.isGroup
        ? {
            leaf: metaLeaf,
            group: catalogGroup(metaLeaf.code, categories),
            score: 8,
            confidence: 0.9,
            evidence: ["Kategorie aus Metadaten"],
            vendorHit: false,
        }
        : classifyExpense(`${text}\n${vendor?.value ?? ""}`, vendor?.value ?? "", categories);
    const leaf = match.leaf;
    const group = match.group;
    if (leaf) {
        fields.category = leaf.nameDe;
        fields.categoryCode = group?.code ?? leaf.parentCode;
        fields.subcategory = leaf.code;
        fields.datevAccount = datevAccountFor(leaf, chart);
        fields.folder = leaf.folder;
        confidenceByField.category = match.confidence;
        confidenceByField.categoryCode = match.confidence;
        confidenceByField.subcategory = match.confidence;
        confidenceByField.datevAccount = match.confidence;
        confidenceByField.folder = match.confidence;
        evidence.push(...match.evidence);
        if (!match.score) warnings.push({ code: "no_category", message: "No category could be identified confidently — please review the booking category." });
    } else {
        warnings.push({ code: "no_category", message: "No booking category found." });
    }

    // Суммы: ставка из документа, из категории, иначе из настроек (только при слове USt/MwSt)
    const rateHint = match.score > 0 ? leaf?.vatRate ?? null : null;
    const amounts = findAmounts(text, meta, input.defaultRate, rateHint);
    evidence.push(...amounts.evidence);
    if (amounts.mixedRates) warnings.push({ code: "mixed_rates", message: "The document shows more than one VAT rate — the total VAT was derived from the amounts." });
    if (amounts.rateMismatch) warnings.push({ code: "rate_mismatch", message: "The printed VAT rate does not match the amounts — the rate was recalculated from net and VAT." });
    if (amounts.net == null && amounts.gross == null) warnings.push({ code: "no_amount", message: "No amount could be read from the document." });

    const normalized = normalizeAmounts(
        { net: amounts.net, gross: amounts.gross, vat: amounts.vat, rate: amounts.rate },
        { defaultRate: 0 }
    );
    fields.netAmount = normalized.netAmount;
    fields.grossAmount = normalized.grossAmount;
    fields.vatAmount = normalized.vatAmount;
    fields.taxRate = amounts.rateExplicit ? normalized.taxRate : (amounts.net != null || amounts.gross != null ? normalized.taxRate : 0);
    if (amounts.net != null && amounts.gross != null) confidenceByField.netAmount = confidenceByField.grossAmount = 0.95;
    else if (amounts.gross != null) confidenceByField.grossAmount = amounts.rateExplicit ? 0.85 : 0.65;
    else if (amounts.net != null) confidenceByField.netAmount = 0.7;
    if (amounts.net != null || amounts.gross != null) confidenceByField.vatAmount = amounts.rateExplicit || amounts.vat != null ? 0.85 : 0.45;
    if (amounts.rateExplicit) confidenceByField.taxRate = 0.95;
    else if (amounts.net != null || amounts.gross != null) confidenceByField.taxRate = 0.45;

    // Vorsteuer: явный запрет важнее категории
    const categoryDeductible = match.score > 0 ? leaf?.deductible ?? true : true;
    const deductibleExplicit = findSalutation(text) || KLEINUNTERNEHMER.test(text);
    fields.inputVatDeductible = deductibleExplicit ? false : categoryDeductible;
    if (KLEINUNTERNEHMER.test(text)) {
        evidence.push("Kein Vorsteuerabzug (§ 19 / ohne Vorsteuer)");
        warnings.push({ code: "kleinunternehmer", message: "Kleinunternehmer / no input VAT deduction was recognised on the document." });
    } else if (REVERSE_CHARGE.test(text)) {
        fields.inputVatDeductible = true;
        evidence.push("Reverse Charge (§ 13b UStG) — Vorsteuer beim Empfänger abziehbar");
        warnings.push({ code: "reverse_charge", message: "Reverse charge recognised: VAT is owed and deductible by the recipient." });
    }
    if (match.score > 0) confidenceByField.inputVatDeductible = deductibleExplicit ? 0.9 : 0.65;

    // Номер документа, дата, реквизиты поставщика
    const metaNumber = meta.documentNumber ? cleanDocNumber(String(meta.documentNumber)) : "";
    const number = metaNumber ? { value: metaNumber, confidence: 0.95, evidence: `Belegnummer: ${metaNumber}` } : findDocumentNumber(text);
    if (number) {
        fields.documentNumber = number.value;
        confidenceByField.documentNumber = number.confidence;
        evidence.push(number.evidence);
    }
    const documentDate = meta.date ? parseDateText(String(meta.date).slice(0, 10)) : "";
    if (documentDate) {
        fields.documentDate = documentDate;
        confidenceByField.documentDate = 0.95;
        evidence.push(`Belegdatum: ${documentDate}`);
    } else {
        const found = findDate(text, DOCUMENT_DATE_LABELS);
        if (found) {
            fields.documentDate = found.value;
            confidenceByField.documentDate = found.confidence;
            evidence.push(found.evidence);
        }
    }
    if (!fields.documentDate) warnings.push({ code: "no_date", message: "No document date was found." });
    const paidDate = meta.paidDate ? parseDateText(String(meta.paidDate).slice(0, 10)) : "";
    if (paidDate) {
        fields.paidDate = paidDate;
        confidenceByField.paidDate = 0.9;
    } else {
        const found = findDate(text, PAID_DATE_LABELS, false);
        if (found) {
            fields.paidDate = found.value;
            confidenceByField.paidDate = found.confidence;
        }
    }
    const vatId = meta.vendorVatId ? normalizeVatId(String(meta.vendorVatId)) : findVatId(text);
    if (vatId) {
        fields.vendorVatId = vatId;
        confidenceByField.vendorVatId = meta.vendorVatId ? 0.9 : 0.85;
        evidence.push(`USt-IdNr.: ${vatId}`);
    }
    const iban = meta.vendorIban ? { value: String(meta.vendorIban).replace(/\s+/g, "").toUpperCase(), checksum: true } : findIban(text);
    if (iban && validIbanStructure(iban.value)) {
        fields.vendorIban = iban.value;
        confidenceByField.vendorIban = meta.vendorIban ? 0.9 : 0.85;
        evidence.push(`IBAN: ${iban.value}`);
        if (!iban.checksum) warnings.push({ code: "iban_checksum", message: "The IBAN checksum is invalid — please verify the bank details." });
    }
    const currency = detectCurrency(text, meta);
    if (currency) {
        fields.currency = currency;
        confidenceByField.currency = meta.currency ? 0.95 : 0.75;
    }

    // Buchungsart и AfA: категория задаёт вид записи, текст может уточнить срок
    const booking = findBookingKind(text, match.score > 0 ? leaf : null);
    fields.bookingKind = booking.kind;
    evidence.push(booking.evidence);
    confidenceByField.bookingKind = booking.explicit ? 0.85 : match.score > 0 ? 0.6 : 0.3;
    if (booking.kind === "Investition") {
        const afa = findAfaYears(text, match.score > 0 ? leaf : null);
        fields.afaYears = afa.years;
        fields.afaResidualValue = afa.residual;
        if (afa.years) {
            confidenceByField.afaYears = 0.6;
            evidence.push(afa.evidence);
        } else {
            warnings.push({ code: "afa_missing_years", message: "Investment recognised but no useful life (AfA years) found — please complete it." });
        }
        if (afa.residual != null) confidenceByField.afaResidualValue = 0.6;
    }
    if (booking.kind === "Privatentnahme") fields.inputVatDeductible = false;

    // Папка: из категории; без категории — Belege/<год>
    if (!fields.folder) {
        const year = (fields.documentDate || input.today || new Date().toISOString().slice(0, 10)).slice(0, 4);
        fields.folder = folderForCategory(fields.subcategory, year, categories);
        confidenceByField.folder = 0.35;
    }

    // Что действительно нашли: пустые строки и нулевые суммы — не находки (inputVatDeductible особый случай)
    const mark = (field: ProposalField, ok: boolean) => {
        if (ok) detected.push(field);
    };
    mark("vendor", !!fields.vendor);
    mark("documentNumber", !!fields.documentNumber);
    mark("documentDate", !!fields.documentDate);
    mark("paidDate", !!fields.paidDate);
    mark("currency", !!fields.currency);
    mark("netAmount", amounts.net != null && fields.netAmount > 0);
    mark("grossAmount", amounts.gross != null && fields.grossAmount > 0);
    mark("vatAmount", fields.vatAmount > 0 || (amounts.vat != null && amounts.vat >= 0 && amounts.rateExplicit));
    mark("taxRate", amounts.rateExplicit || amounts.net != null || amounts.gross != null);
    mark("inputVatDeductible", match.score > 0 || deductibleExplicit || REVERSE_CHARGE.test(text));
    mark("category", !!fields.category);
    mark("categoryCode", !!fields.categoryCode);
    mark("subcategory", !!fields.subcategory);
    mark("datevAccount", !!fields.datevAccount);
    mark("folder", !!fields.folder);
    mark("bookingKind", booking.explicit || match.score > 0);
    mark("afaYears", fields.afaYears != null);
    mark("afaResidualValue", fields.afaResidualValue != null);
    mark("vendorVatId", !!fields.vendorVatId);
    mark("vendorIban", !!fields.vendorIban);

    // Уверенность: взвешенная, а не «средняя по найденному» — отсутствие суммы должно её снижать
    const weightOf = (field: ProposalField, weight: number) => (confidenceByField[field] ?? 0) * weight;
    const confidence = round2(
        weightOf("grossAmount", 0.24) +
        weightOf("netAmount", 0.06) +
        weightOf("taxRate", 0.1) +
        weightOf("category", 0.24) +
        weightOf("vendor", 0.12) +
        weightOf("documentNumber", 0.07) +
        weightOf("documentDate", 0.08) +
        weightOf("vendorVatId", 0.04) +
        weightOf("vendorIban", 0.03) +
        weightOf("bookingKind", 0.02)
    );
    const criticalWarning = warnings.some((w) => ["no_amount", "mixed_rates", "rate_mismatch"].includes(w.code));
    const reviewStatus: ExpenseReviewStatus = confidence >= 0.8 && (confidenceByField.category ?? 0) >= 0.6 && fields.grossAmount > 0 && !criticalWarning ? "AUTO" : "REVIEW";

    return {
        fields,
        detected,
        confidence,
        confidenceByField,
        reviewStatus,
        evidence: Array.from(new Set(evidence)).slice(0, 12),
        warnings,
        category: leaf
            ? { code: leaf.code, parentCode: leaf.parentCode, nameDe: leaf.nameDe, nameEn: leaf.nameEn, account: datevAccountFor(leaf, chart) }
            : null,
    };
}
