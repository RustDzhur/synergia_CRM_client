export interface LineItem { qty: number; unitPrice: number; taxRate: number }

// Налог считается ОДНИМ правилом: либо документ освобождён от налога (малый бизнес, §19 UStG и аналоги) —
// тогда налога нет вовсе и итог равен нетто, либо ставка берётся из строки.
// Раньше освобождение только прятало строку «налог» в PDF, а сам налог продолжал сидеть в итоге —
// клиенту выставлялась сумма, которой он не должен.
export interface TotalsOptions {
    exempt?: boolean; // документ без налога: ставки строк игнорируются
}

export function computeTotals(items: LineItem[], opts: TotalsOptions = {}) {
    let net = 0;
    let tax = 0;
    for (const it of items) {
        const line = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
        net += line;
        if (!opts.exempt) tax += line * ((Number(it.taxRate) || 0) / 100);
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    const netR = round(net);
    const taxR = round(tax);
    return { net: netR, tax: taxR, gross: round(netR + taxR), exempt: !!opts.exempt };
}

// Разбивка налога по ставкам. В Германии (§14 Abs. 4 Nr. 8 UStG) налог в счёте со смешанными
// ставками обязан печататься отдельной суммой по каждой ставке, а не одной общей цифрой.
export function taxBreakdown(items: LineItem[], opts: TotalsOptions = {}): Array<{ rate: number; net: number; tax: number }> {
    if (opts.exempt) return [];
    const round = (n: number) => Math.round(n * 100) / 100;
    const byRate = new Map<number, number>();
    for (const it of items) {
        const line = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
        const rate = Number(it.taxRate) || 0;
        byRate.set(rate, (byRate.get(rate) ?? 0) + line);
    }
    return Array.from(byRate.entries())
        .map(([rate, net]) => ({ rate, net: round(net), tax: round(net * (rate / 100)) }))
        .sort((a, b) => b.rate - a.rate);
}

type CleanItem = { description: string; qty: number; unitPrice: number; taxRate: number; product?: string; unit?: string };

const cleanItem = (v: unknown): CleanItem | null => {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const description = typeof o.description === "string" ? o.description.trim().slice(0, 300) : "";
    if (!description) return null;
    const num = (x: unknown, def: number) => (Number.isFinite(Number(x)) ? Number(x) : def);
    const out: CleanItem = {
        description,
        qty: Math.max(0.001, num(o.qty, 1)),
        unitPrice: Math.max(0, num(o.unitPrice, 0)),
        taxRate: Math.min(100, Math.max(0, num(o.taxRate, 0))),
    };
    if (typeof o.product === "string" && /^[0-9a-f]{24}$/i.test(o.product)) out.product = o.product;
    // единица измерения: обязательный реквизит электронного счёта-фактуры Узбекистана; в других рынках просто сохраняется
    if (typeof o.unit === "string" && o.unit.trim()) out.unit = o.unit.replace(/[\p{Cc}<>]/gu, " ").trim().slice(0, 16);
    return out;
};

// Список строк из тела запроса: недоверенные данные — проверяем каждое поле, отбрасываем пустые/некорректные строки
export function cleanItems(v: unknown, max = 100) {
    if (!Array.isArray(v)) return [];
    return v.slice(0, max).map(cleanItem).filter((x): x is CleanItem => x !== null);
}
