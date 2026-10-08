import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { computeTotals } from "@/lib/finance/totals";
import { prisma } from "@/lib/prisma";
import { defaultCurrency } from "@/lib/finance/settings";

export const dynamic = "force-dynamic";

// GET /api/finance/dashboard?months=6 — цифры для карточки «Finance» на Dashboard: доход (оплаченные счета), к получению
// (отправленные/просроченные), расходы, прибыль, помесячный ряд для графика, склад с низким остатком, воронка заказов.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const q = new URL(req.url).searchParams;
    // ?year=2026 — календарный год: всегда 12 столбцов, с января по декабрь (будущие месяцы пустые).
    // Без year — последние ?months= месяцев (по умолчанию 6).
    const year = Number(q.get("year"));
    const byYear = Number.isInteger(year) && year >= 2000 && year <= 2100;
    const months = byYear ? 12 : Math.min(24, Math.max(1, Number(q.get("months")) || 6));

    const since = byYear ? new Date(year, 0, 1) : new Date();
    if (!byYear) { since.setMonth(since.getMonth() - months + 1); since.setDate(1); }
    // дата начала строкой без перевода в UTC: иначе 1 января по местному времени превращалось в 31 декабря
    const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-01`;
    const until = byYear ? new Date(year + 1, 0, 1) : new Date(Date.now() + 366 * 86400000);
    const untilStr = `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, "0")}-01`;
    const base = await defaultCurrency(user.id);
    const [invoices, expenses, purchaseInvoices, orders, products] = await Promise.all([
        // Открытые счета нужны все (долг не имеет срока давности), оплаченные — только за выбранный период:
        // раньше «доход» считался за всё время, а расходы за период, и прибыль не сходилась. Грузим только нужное, а не все счета фирмы.
        prisma.invoice.findMany({
            where: {
                org: user.id, kind: "invoice",
                OR: [{ status: { in: ["draft", "sent", "overdue"] } }, { status: "paid", OR: [{ paidAt: { gte: since, lt: until } }, { paidAt: null, issueDate: { gte: sinceStr, lt: untilStr } }] }],
            },
            select: { status: true, issueDate: true, paidAt: true, paidAmount: true, items: true, currency: true },
        }),
        prisma.expense.findMany({ where: { org: user.id, date: { gte: sinceStr, lt: untilStr } }, select: { amount: true, date: true, currency: true } }),
        // Закупки — такие же расходы, как Expense: без них «Прибыль» на дашборде была завышена
        prisma.supplierInvoice.findMany({ where: { org: user.id, status: { not: "cancelled" }, date: { gte: sinceStr, lt: untilStr } }, select: { amount: true, date: true } }),
        prisma.order.findMany({ where: { org: user.id }, select: { status: true } }),
        prisma.product.findMany({ where: { org: user.id, type: "good", archived: false }, select: { id: true, name: true, stockQty: true, reorderLevel: true } }),
    ]);
    // $expr-сравнение stockQty <= reorderLevel (между полями одной записи) считаем в JS: товаров немного
    const lowStock = products.filter((p) => (p.stockQty ?? 0) <= (p.reorderLevel ?? 0)).slice(0, 20);

    // Суммы разных валют не складываются: итоги идут в основной валюте фирмы, счета в других валютах считаются отдельно
    const inBase = invoices.filter((i) => (i.currency || base) === base);
    const otherCurrency = invoices.length - inBase.length + expenses.filter((e) => (e.currency || base) !== base).length;
    const paid = inBase.filter((i) => i.status === "paid");
    const outstanding = inBase.filter((i) => i.status === "sent" || i.status === "overdue");
    const round = (n: number) => Math.round(n * 100) / 100;
    const sum = (list: typeof invoices) => list.reduce((s, i) => s + computeTotals(i.items as any).gross, 0);
    // к получению — остаток по счёту, а не его полная сумма: частичная оплата уже получена
    const owed = (list: typeof invoices) => list.reduce((s, i) => s + Math.max(0, computeTotals(i.items as any).gross - (Number(i.paidAmount) || 0)), 0);
    const revenue = round(sum(paid));
    const outstandingAmount = round(owed(outstanding));
    const overdueAmount = round(owed(inBase.filter((i) => i.status === "overdue")));
    const totalExpenses = round(expenses.filter((e) => (e.currency || base) === base).reduce((s, e) => s + (e.amount ?? 0), 0) + purchaseInvoices.reduce((s, p) => s + (p.amount ?? 0), 0));

    // помесячный ряд за period: доход по дате оплаты, расход по дате
    const key = (d: string | Date) => {
        // «2026-03-01» читается как UTC-полночь, и в поясе западнее UTC месяц уезжал назад — для строк берём год и месяц как написано
        if (typeof d === "string" && /^\d{4}-\d{2}/.test(d)) return d.slice(0, 7);
        const dt = typeof d === "string" ? new Date(d) : d; return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; };
    const series: Record<string, { revenue: number; expenses: number }> = {};
    for (let i = 0; i < months; i++) { const d = new Date(since); d.setMonth(d.getMonth() + i); series[key(d)] = { revenue: 0, expenses: 0 }; }
    for (const inv of paid) if ((inv.paidAt ?? inv.issueDate) && series[key((inv.paidAt ?? inv.issueDate) as string | Date)]) series[key((inv.paidAt ?? inv.issueDate) as string | Date)].revenue += computeTotals(inv.items as any).gross;
    for (const e of expenses.filter((x) => (x.currency || base) === base)) if (series[key(e.date)]) series[key(e.date)].expenses += e.amount ?? 0;
    for (const p of purchaseInvoices) if (series[key(p.date)]) series[key(p.date)].expenses += p.amount ?? 0;

    const orderCounts: Record<string, number> = {};
    for (const o of orders) orderCounts[o.status] = (orderCounts[o.status] ?? 0) + 1;

    return NextResponse.json({
        revenue, outstandingAmount, overdueAmount, expenses: totalExpenses, profit: round(revenue - totalExpenses), currency: base, otherCurrency,
        invoiceCounts: { paid: paid.length, outstanding: outstanding.length, overdue: inBase.filter((i) => i.status === "overdue").length, draft: inBase.filter((i) => i.status === "draft").length },
        orderCounts,
        series: Object.entries(series).map(([month, v]) => ({ month, ...v })),
        lowStock: lowStock.map((p) => ({ id: p.id, name: p.name, stockQty: p.stockQty, reorderLevel: p.reorderLevel })),
    });
}
