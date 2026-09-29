// Арифметика отчётов отдельно от базы: сюда приходят уже выбранные документы, отсюда — готовые суммы.
// Так расчёт можно проверить тестом, не поднимая Mongo, и он один для всех отчётов.

export interface ReportLine { qty: number; unitPrice: number; taxRate?: number }
export interface ReportDoc { items?: ReportLine[]; date?: string; paidAmount?: number; category?: string; amount?: number; taxRate?: number }

const round = (n: number) => Math.round(n * 100) / 100;

// Сумма строки без налога
export const netOfLine = (it: ReportLine) => (Number(it?.qty) || 0) * (Number(it?.unitPrice) || 0);

// Сумма строки с налогом (для сальдо по неоплаченным счетам)
export const grossOfLine = (it: ReportLine) => {
    const net = netOfLine(it);
    return net * (1 + (Number(it?.taxRate) || 0) / 100);
};

export const sumNet = (items: ReportLine[] = []) => round((items ?? []).reduce((s, it) => s + netOfLine(it), 0));
export const sumGross = (items: ReportLine[] = []) => round((items ?? []).reduce((s, it) => s + grossOfLine(it), 0));

// Обороты по ставкам: счета увеличивают, кредит-ноты уменьшают. У освобождённой фирмы ставка всегда 0 —
// налог не начисляется ни в одной строке, что бы ни стояло в документе.
export function salesByRate(invoices: ReportDoc[], creditNotes: ReportDoc[], exempt: boolean): Array<{ rate: number; net: number; tax: number }> {
    const acc = new Map<number, { net: number; tax: number }>();
    const add = (rate: number, net: number) => {
        const cur = acc.get(rate) ?? { net: 0, tax: 0 };
        cur.net += net;
        cur.tax += exempt ? 0 : net * (rate / 100);
        acc.set(rate, cur);
    };
    for (const doc of invoices) for (const it of doc.items ?? []) add(exempt ? 0 : Number(it.taxRate) || 0, netOfLine(it));
    for (const doc of creditNotes) for (const it of doc.items ?? []) add(exempt ? 0 : Number(it.taxRate) || 0, -netOfLine(it));
    return Array.from(acc.entries())
        .map(([rate, v]) => ({ rate, net: round(v.net), tax: round(v.tax) }))
        .sort((a, b) => b.rate - a.rate);
}

// Вычет по расходам: у освобождённой фирмы права на вычет нет
export function inputVatByRate(expenses: ReportDoc[], exempt: boolean): Array<{ rate: number; net: number; tax: number }> {
    const acc = new Map<number, { net: number; tax: number }>();
    for (const e of expenses) {
        const net = Number(e.amount) || 0;
        const rate = Number(e.taxRate) || 0;
        const cur = acc.get(rate) ?? { net: 0, tax: 0 };
        cur.net += net;
        cur.tax += exempt ? 0 : net * (rate / 100);
        acc.set(rate, cur);
    }
    return Array.from(acc.entries())
        .map(([rate, v]) => ({ rate, net: round(v.net), tax: round(v.tax) }))
        .sort((a, b) => b.rate - a.rate);
}

export const totalNet = (lines: Array<{ net: number }>) => round(lines.reduce((s, l) => s + l.net, 0));
export const totalTax = (lines: Array<{ tax: number }>) => round(lines.reduce((s, l) => s + l.tax, 0));

// Доходы и расходы по месяцам для BWA
export interface MonthRow { period: string; revenue: number; costs: number; profit: number }

export function monthlySeries(invoices: ReportDoc[], creditNotes: ReportDoc[], expenses: ReportDoc[]): MonthRow[] {
    const months = new Map<string, { revenue: number; costs: number }>();
    const ensure = (p: string) => {
        if (!months.has(p)) months.set(p, { revenue: 0, costs: 0 });
        return months.get(p)!;
    };
    const periodOf = (d?: string) => (d || "").slice(0, 7);
    for (const doc of invoices) { const p = periodOf(doc.date); if (p) ensure(p).revenue += sumNet(doc.items); }
    for (const doc of creditNotes) { const p = periodOf(doc.date); if (p) ensure(p).revenue -= sumNet(doc.items); }
    for (const e of expenses) { const p = periodOf(e.date); if (p) ensure(p).costs += Number(e.amount) || 0; }
    return Array.from(months.entries())
        .map(([period, v]) => ({ period, revenue: round(v.revenue), costs: round(v.costs), profit: round(v.revenue - v.costs) }))
        .sort((a, b) => a.period.localeCompare(b.period));
}

// Расходы по категориям: категория — свободная строка из документа, пустая попадает в «Ohne Zuordnung»
export function costsByCategory(expenses: ReportDoc[], fallback = "Ohne Zuordnung"): Array<{ label: string; amount: number }> {
    const acc = new Map<string, number>();
    for (const e of expenses) {
        const key = (e.category || "").trim() || fallback;
        acc.set(key, (acc.get(key) ?? 0) + (Number(e.amount) || 0));
    }
    return Array.from(acc.entries())
        .map(([label, amount]) => ({ label, amount: round(amount) }))
        .sort((a, b) => b.amount - a.amount);
}

// Доход по оплате: у счёта берём фактически оплаченную сумму, если она записана, иначе сумму строк
export function incomeOf(paidInvoices: ReportDoc[], creditNotes: ReportDoc[]): number {
    const paid = paidInvoices.reduce((s, inv) => s + (Number(inv.paidAmount) || sumNet(inv.items)), 0);
    const credited = creditNotes.reduce((s, cn) => s + sumNet(cn.items), 0);
    return round(paid - credited);
}

// Границы периода по умолчанию: месяц, квартал или год — то, за что обычно отчитываются
export type PeriodKind = "month" | "quarter" | "year";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function periodRange(kind: PeriodKind, today = new Date()): { from: string; to: string } {
    const y = today.getFullYear();
    const m = today.getMonth();
    if (kind === "year") return { from: `${y}-01-01`, to: `${y}-12-31` };
    if (kind === "quarter") {
        const q = Math.floor(m / 3);
        return { from: iso(new Date(Date.UTC(y, q * 3, 1))), to: iso(new Date(Date.UTC(y, q * 3 + 3, 0))) };
    }
    return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) };
}
