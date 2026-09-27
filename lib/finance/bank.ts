// Импорт банковской выписки. Банки отдают CSV по-разному: разделитель «;» или «,», дата «31.12.2026»
// или «2026-12-31», суммы «1.234,56» или «1234.56», у каждого свой набор колонок. Поэтому разбор
// терпимый: сначала ищем колонки по заголовкам, и только если их нет — берём по порядку.
//
// Функции здесь чистые (на вход текст, на выход данные) — их можно проверить тестом без базы.

export interface ParsedTransaction {
    date: string;        // "YYYY-MM-DD"
    amount: number;      // плюс приход, минус расход
    counterparty: string;
    reference: string;
    externalId: string;  // если банк даёт идентификатор строки — по нему ловим повторный импорт
}

export interface ParseResult {
    rows: ParsedTransaction[];
    skipped: number;      // строк, которые не удалось разобрать
    delimiter: string;
    columns: Record<string, string>; // какой заголовок использован для какого поля — показываем пользователю
}

// Заголовки, которые банки используют для одних и тех же полей (немецкие и английские)
const HINTS: Record<keyof Omit<ParsedTransaction, "">, RegExp> = {
    date: /^(buchungstag|buchungsdatum|datum|valuta|wertstellung|date|booking date|fecha)$/i,
    amount: /^(betrag|umsatz|betrag \(€\)|umsatz \(€\)|amount|summe|soll\/haben)$/i,
    counterparty: /^(beguenstigter|begünstigter|auftraggeber|empf(ä|a)nger|name|zahlungspflichtiger|payee|payer|beguenstigter\/zahlungspflichtiger)$/i,
    reference: /^(verwendungszweck|buchungstext|referenz|beschreibung|description|details|payment reference)$/i,
    externalId: /^(auftragsnummer|referenznummer|belegnummer|transaktionsnummer|id|transaction id)$/i,
};

const pad = (n: number) => String(n).padStart(2, "0");

// Дата: «31.12.2026», «2026-12-31», «31/12/2026», «20261231»
export function parseDate(raw: string): string {
    const s = (raw || "").trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
    if (m) {
        const year = m[3].length === 2 ? `20${m[3]}` : m[3];
        return `${year}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
    }
    m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return "";
}

// Сумма: «1.234,56», «1234,56», «1,234.56», «-1234.56», «1.234,56 €»
export function parseAmount(raw: string): number {
    let s = (raw || "").replace(/[^\d,.\-+]/g, "").trim();
    if (!s) return NaN;
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    // разделитель дробной части — тот, что стоит позже; всё остальное считаем разделителями тысяч
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else if (lastDot > lastComma) s = s.replace(/,/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

// Разбор строки CSV с учётом кавычек: банки заключают назначение платежа в кавычки,
// потому что внутри бывают и точки с запятой, и переводы строк.
function splitLine(line: string, delimiter: string): string[] {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
            if (ch === '"') {
                if (line[i + 1] === '"') { cur += '"'; i++; }
                else quoted = false;
            } else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === delimiter) { out.push(cur); cur = ""; }
        else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
}

// Определяем разделитель по первой строке: у немецких выписок почти всегда «;», у экспорта из Англии «,»
function detectDelimiter(line: string): string {
    const counts: Array<[string, number]> = [[";", (line.match(/;/g) ?? []).length], [",", (line.match(/,/g) ?? []).length], ["\t", (line.match(/\t/g) ?? []).length]];
    counts.sort((a, b) => b[1] - a[1]);
    return counts[0][1] > 0 ? counts[0][0] : ";";
}

export function parseBankCsv(text: string): ParseResult {
    // переводы строк внутри кавычек склеиваем обратно: иначе одна запись распадётся на несколько строк
    const rawLines: string[] = [];
    let buffer = "";
    let quoted = false;
    for (const ch of text.replace(/\r\n?/g, "\n")) {
        if (ch === '"') quoted = !quoted;
        if (ch === "\n" && !quoted) { rawLines.push(buffer); buffer = ""; }
        else buffer += ch;
    }
    if (buffer) rawLines.push(buffer);

    const lines = rawLines.filter((l) => l.trim());
    if (!lines.length) return { rows: [], skipped: 0, delimiter: ";", columns: {} };

    const delimiter = detectDelimiter(lines[0]);
    // заголовок — одна из первых трёх строк: перед ним банки иногда пишут название и период
    let headerIndex = -1;
    let map: Partial<Record<keyof ParsedTransaction, number>> = {};
    for (let i = 0; i < Math.min(3, lines.length); i++) {
        const cells = splitLine(lines[i], delimiter);
        const candidate: Partial<Record<keyof ParsedTransaction, number>> = {};
        cells.forEach((cell, index) => {
            for (const [field, re] of Object.entries(HINTS) as Array<[keyof ParsedTransaction, RegExp]>) {
                if (candidate[field] === undefined && re.test(cell.replace(/^"|"$/g, ""))) candidate[field] = index;
            }
        });
        if (candidate.date !== undefined && candidate.amount !== undefined) { headerIndex = i; map = candidate; break; }
    }

    // Заголовков нет — разбираем по порядку: дата, сумма, контрагент, назначение.
    // Не идеально, но лучше, чем ничего, и результат пользователь видит перед сохранением.
    const positional = headerIndex === -1;
    if (positional) map = { date: 0, amount: 1, counterparty: 2, reference: 3 };

    const rows: ParsedTransaction[] = [];
    let skipped = 0;
    for (let i = headerIndex + 1; i < lines.length; i++) {
        const cells = splitLine(lines[i], delimiter);
        const date = parseDate(cells[map.date ?? 0] ?? "");
        const amount = parseAmount(cells[map.amount ?? 1] ?? "");
        if (!date || !Number.isFinite(amount)) { skipped++; continue; }
        rows.push({
            date,
            amount,
            counterparty: (cells[map.counterparty ?? -1] ?? "").slice(0, 200),
            reference: (cells[map.reference ?? -1] ?? "").slice(0, 500),
            externalId: (cells[map.externalId ?? -1] ?? "").slice(0, 120),
        });
    }

    const columns: Record<string, string> = {};
    if (!positional) {
        const header = splitLine(lines[headerIndex], delimiter);
        for (const [field, index] of Object.entries(map) as Array<[keyof ParsedTransaction, number]>) {
            if (header[index]) columns[field] = header[index];
        }
    }
    return { rows, skipped, delimiter, columns };
}

// ── Сверка ────────────────────────────────────────────────────────────────────────────────────────────────

export interface MatchCandidate {
    id: string;
    label: string;   // номер и клиент — то, что показываем в списке
    amount: number;  // ожидаемая сумма (брутто по счёту или сумма расхода)
    date: string;
}

export interface MatchSuggestion {
    transactionExternalId: string; // индекс строки в списке (клиент сопоставляет сам)
    candidateId: string;
    reason: "reference" | "amount_date" | "amount";
    score: number; // 3 — совпал номер документа в назначении, 2 — сумма и дата, 1 — только сумма
}

// Номер документа в назначении платежа — самый надёжный признак: клиенты почти всегда его указывают
const numberIn = (reference: string, number: string) => {
    if (!number) return false;
    const clean = (s: string) => s.replace(/[^0-9a-z]/gi, "").toLowerCase();
    return clean(reference).includes(clean(number));
};

export function suggestMatches(
    transactions: Array<{ index: number; amount: number; date: string; reference: string; counterparty: string }>,
    candidates: MatchCandidate[]
): MatchSuggestion[] {
    const out: MatchSuggestion[] = [];
    const dayGap = (a: string, b: string) => {
        const da = Date.parse(`${a}T00:00:00Z`);
        const db = Date.parse(`${b}T00:00:00Z`);
        return Number.isFinite(da) && Number.isFinite(db) ? Math.abs(da - db) / 86400000 : 999;
    };
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

    for (const t of transactions) {
        // приход сверяем со счетами (клиент заплатил), расход — с расходами
        const pool = candidates.filter((c) => (t.amount > 0 ? c.amount > 0 : c.amount < 0));
        const byNumber = pool.find((c) => numberIn(t.reference, c.label.split(" ")[0]));
        if (byNumber) { out.push({ transactionExternalId: String(t.index), candidateId: byNumber.id, reason: "reference", score: 3 }); continue; }
        const sameAmount = pool.filter((c) => Math.abs(c.amount - t.amount) < 0.01);
        if (!sameAmount.length) continue;
        // сумма и дата рядом — уверенная догадка; иначе оставляем по сумме и просим человека проверить
        const near = sameAmount.find((c) => dayGap(c.date, t.date) <= 14);
        if (near) out.push({ transactionExternalId: String(t.index), candidateId: near.id, reason: "amount_date", score: 2 });
        else out.push({ transactionExternalId: String(t.index), candidateId: sameAmount[0].id, reason: "amount", score: 1 });
    }
    return out;
}

// Сальдо по счёту: остаток на начало плюс все движения до даты включительно
export function balanceAt(openingBalance: number, transactions: Array<{ date: string; amount: number }>, to?: string): number {
    const sum = transactions
        .filter((t) => !to || t.date <= to)
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return Math.round((openingBalance + sum) * 100) / 100;
}
