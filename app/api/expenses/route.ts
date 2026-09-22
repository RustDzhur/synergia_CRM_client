import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import User from "@/models/User";
import Expense from "@/models/Expense";

export const dynamic = "force-dynamic";

const toDTO = (e: any) => ({
    id: String(e._id), vendor: e.vendor, category: e.category, amount: e.amount, taxRate: e.taxRate, currency: e.currency,
    date: e.date, deal: e.deal ? String(e.deal) : "", order: e.order ? String(e.order) : "", receipt: e.receipt ? String(e.receipt) : "",
    recurring: e.recurring, notes: e.notes, createdByName: e.createdByName,
});

// GET /api/expenses?from=&to= — расходы фирмы за период (по умолчанию — все), самые новые первыми
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const url = new URL(req.url);
    const filter: Record<string, unknown> = { org: user.id };
    const from = url.searchParams.get("from"); const to = url.searchParams.get("to");
    if (from || to) filter.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const list = await Expense.find(filter).sort({ date: -1 }).limit(500);
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
    await connectDB();
    const author = await User.findById(user.userId).select("firstname lastname");
    const expense = await Expense.create({
        org: user.id, vendor, amount, date,
        category: typeof b.category === "string" ? b.category.trim().slice(0, 100) : "",
        taxRate: Number.isFinite(Number(b.taxRate)) ? Math.min(100, Math.max(0, Number(b.taxRate))) : 0,
        currency: typeof b.currency === "string" && b.currency.trim() ? b.currency.trim().slice(0, 6).toUpperCase() : "EUR",
        deal: b.deal || undefined, order: b.order || undefined, receipt: b.receipt || undefined,
        recurring: ["monthly", "yearly"].includes(b.recurring) ? b.recurring : "",
        notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : "",
        createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
    });
    await logAudit({ org: user.id, userId: user.userId, action: "expense.created", entityType: "expense", entityId: String(expense._id), summary: `Expense ${expense.vendor} — ${expense.amount} ${expense.currency}`, meta: { amount: expense.amount, currency: expense.currency } });
    return NextResponse.json(toDTO(expense), { status: 201 });
}
