import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { computeTotals } from "@/lib/finance/totals";
import Invoice from "@/models/Invoice";
import Expense from "@/models/Expense";
import Order from "@/models/Order";
import Product from "@/models/Product";

export const dynamic = "force-dynamic";

// GET /api/finance/dashboard?months=6 — цифры для карточки «Finance» на Dashboard: доход (оплаченные счета), к получению
// (отправленные/просроченные), расходы, прибыль, помесячный ряд для графика, склад с низким остатком, воронка заказов.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const months = Math.min(24, Math.max(1, Number(new URL(req.url).searchParams.get("months")) || 6));
    await connectDB();

    const since = new Date(); since.setMonth(since.getMonth() - months + 1); since.setDate(1);
    const [invoices, expenses, orders, lowStock] = await Promise.all([
        Invoice.find({ org: user.id, kind: "invoice" }).select("status issueDate paidAt items currency"),
        Expense.find({ org: user.id, date: { $gte: since.toISOString().slice(0, 10) } }).select("amount date"),
        Order.find({ org: user.id }).select("status"),
        Product.find({ org: user.id, type: "good", archived: { $ne: true }, $expr: { $lte: ["$stockQty", "$reorderLevel"] } }).select("name stockQty reorderLevel").limit(20),
    ]);

    const paid = invoices.filter((i) => i.status === "paid");
    const outstanding = invoices.filter((i) => i.status === "sent" || i.status === "overdue");
    const sum = (list: typeof invoices) => list.reduce((s, i) => s + computeTotals(i.items as any).gross, 0);
    const revenue = sum(paid);
    const outstandingAmount = sum(outstanding);
    const overdueAmount = sum(invoices.filter((i) => i.status === "overdue"));
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);

    // помесячный ряд за period: доход по дате оплаты, расход по дате
    const key = (d: string | Date) => { const dt = typeof d === "string" ? new Date(d) : d; return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; };
    const series: Record<string, { revenue: number; expenses: number }> = {};
    for (let i = 0; i < months; i++) { const d = new Date(since); d.setMonth(d.getMonth() + i); series[key(d)] = { revenue: 0, expenses: 0 }; }
    for (const inv of paid) if (inv.paidAt && series[key(inv.paidAt)]) series[key(inv.paidAt)].revenue += computeTotals(inv.items as any).gross;
    for (const e of expenses) if (series[key(e.date)]) series[key(e.date)].expenses += e.amount ?? 0;

    const orderCounts: Record<string, number> = {};
    for (const o of orders) orderCounts[o.status] = (orderCounts[o.status] ?? 0) + 1;

    return NextResponse.json({
        revenue, outstandingAmount, overdueAmount, expenses: totalExpenses, profit: revenue - totalExpenses,
        invoiceCounts: { paid: paid.length, outstanding: outstanding.length, overdue: invoices.filter((i) => i.status === "overdue").length, draft: invoices.filter((i) => i.status === "draft").length },
        orderCounts,
        series: Object.entries(series).map(([month, v]) => ({ month, ...v })),
        lowStock: lowStock.map((p) => ({ id: String(p._id), name: p.name, stockQty: p.stockQty, reorderLevel: p.reorderLevel })),
    });
}
