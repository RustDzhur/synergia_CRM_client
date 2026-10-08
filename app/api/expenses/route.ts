import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, validId } from "@/lib/api";
import { ownedDeal } from "@/lib/deals";
import { emit } from "@/lib/automation/emit";
import { logActivity } from "@/lib/sync/feed";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { defaultCurrency } from "@/lib/finance/settings";
import { fx } from "@/lib/sync/texts";

export const dynamic = "force-dynamic";

const toDTO = (e: any) => ({
    id: e.id, vendor: e.vendor, category: e.category, amount: e.amount, taxRate: e.taxRate, currency: e.currency,
    date: e.date, deal: e.deal ?? "", order: e.order ?? "", receipt: e.receipt ?? "",
    recurring: e.recurring, notes: e.notes, createdByName: e.createdByName,
});

// GET /api/expenses?from=&to= — расходы фирмы за период (по умолчанию — все), самые новые первыми
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const where: Record<string, unknown> = { org: user.id };
    const from = url.searchParams.get("from"); const to = url.searchParams.get("to");
    if (from || to) where.date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    const list = await prisma.expense.findMany({ where: where as any, orderBy: { date: "desc" }, take: 500 });
    return NextResponse.json(list.map(toDTO));
}

// POST /api/expenses
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const vendor = typeof b?.vendor === "string" ? b.vendor.trim().slice(0, 200) : "";
    const amount = Number(b?.amount);
    if (!vendor) return badRequest("vendor is required");
    if (!Number.isFinite(amount) || amount < 0) return badRequest("amount must be a non-negative number");
    const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10);
    // Ссылки на сделку, заказ и файл чека принимаются, только если они принадлежат этой фирме: чужой id привязать нельзя
    const [deal, order, receipt] = await Promise.all([
        b.deal ? ownedDeal(b.deal, user.id) : null,
        b.order && validId(String(b.order)) ? prisma.order.findFirst({ where: { id: String(b.order), org: user.id }, select: { id: true } }) : null,
        b.receipt && validId(String(b.receipt)) ? prisma.docItem.findFirst({ where: { id: String(b.receipt), owner: user.id }, select: { id: true } }) : null,
    ]);
    if ((b.deal && !deal) || (b.order && !order) || (b.receipt && !receipt)) return badRequest("deal, order or receipt not found");
    const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
    const expense = await prisma.expense.create({
        data: {
            org: user.id, vendor, amount, date,
            category: typeof b.category === "string" ? b.category.trim().slice(0, 100) : "",
            taxRate: Number.isFinite(Number(b.taxRate)) ? Math.min(100, Math.max(0, Number(b.taxRate))) : 0,
            currency: typeof b.currency === "string" && b.currency.trim() ? b.currency.trim().slice(0, 6).toUpperCase() : await defaultCurrency(user.id),
            deal: deal ?? undefined, order: order ? order.id : undefined, receipt: receipt ? receipt.id : undefined,
            recurring: ["monthly", "yearly"].includes(b.recurring) ? b.recurring : "",
            notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : "",
            createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        },
    });
    await logAudit({ org: user.id, userId: user.userId, action: "expense.created", entityType: "expense", entityId: expense.id, summary: `Expense ${expense.vendor} — ${expense.amount} ${expense.currency}`, meta: { amount: expense.amount, currency: expense.currency } });
    // расход по сделке виден в её ленте (и в ленте клиента сделки): иначе маржа сделки менялась бы незаметно
    if (expense.deal) {
        const d = await prisma.deal.findFirst({ where: { id: expense.deal, owner: user.id }, select: { id: true, contact: true, company: true } });
        if (d) await logActivity(user.id, { deal: d.id, contact: d.contact, company: d.company }, { type: "expense", text: fx("expense", { vendor: expense.vendor, amount: expense.amount, currency: expense.currency }), meta: `expense:${expense.id}`, key: `expense:${expense.id}` });
    }
    await emit(user.id, { type: "expense_created", data: { id: expense.id, vendor: expense.vendor, amount: String(expense.amount), currency: expense.currency, dealId: expense.deal ?? "" } });
    return NextResponse.json(toDTO(expense), { status: 201 });
}
