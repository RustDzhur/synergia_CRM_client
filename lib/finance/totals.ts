export interface LineItem { qty: number; unitPrice: number; taxRate: number }

// Netto/налог/брутто по строкам счёта или заказа — одна и та же формула везде, чтобы дашборд, счёт и API не расходились
export function computeTotals(items: LineItem[]) {
    let net = 0;
    let tax = 0;
    for (const it of items) {
        const line = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
        net += line;
        tax += line * ((Number(it.taxRate) || 0) / 100);
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    return { net: round(net), tax: round(tax), gross: round(net + tax) };
}

const cleanItem = (v: unknown): { description: string; qty: number; unitPrice: number; taxRate: number; product?: string } | null => {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const description = typeof o.description === "string" ? o.description.trim().slice(0, 300) : "";
    if (!description) return null;
    const num = (x: unknown, def: number) => (Number.isFinite(Number(x)) ? Number(x) : def);
    const out: { description: string; qty: number; unitPrice: number; taxRate: number; product?: string } = {
        description,
        qty: Math.max(0.001, num(o.qty, 1)),
        unitPrice: Math.max(0, num(o.unitPrice, 0)),
        taxRate: Math.min(100, Math.max(0, num(o.taxRate, 0))),
    };
    if (typeof o.product === "string" && /^[0-9a-f]{24}$/i.test(o.product)) out.product = o.product;
    return out;
};

// Список строк из тела запроса: недоверенные данные — проверяем каждое поле, отбрасываем пустые/некорректные строки
export function cleanItems(v: unknown, max = 100) {
    if (!Array.isArray(v)) return [];
    return v.slice(0, max).map(cleanItem).filter((x): x is NonNullable<typeof x> => x !== null);
}
