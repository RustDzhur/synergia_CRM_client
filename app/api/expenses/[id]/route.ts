import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const expense = await prisma.expense.findFirst({ where: { id: params.id, org: user.id } });
    if (!expense) return notFound();
    await prisma.expense.deleteMany({ where: { id: expense.id } });
    await logAudit({ org: user.id, userId: user.userId, action: "expense.deleted", entityType: "expense", entityId: params.id, summary: `Expense ${expense.vendor} — ${expense.amount} ${expense.currency} — deleted`, meta: { amount: expense.amount, currency: expense.currency } });
    return NextResponse.json({ ok: true });
}

// PATCH /api/expenses/:id — пока только отметка полученного электронного счёта-фактуры поставщика (рынок UZ):
// { esf: { number, date, supplierInn } } — основание для вычета входного QQS. null снимает отметку.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => null);
    const expense = await prisma.expense.findFirst({ where: { id: params.id, org: user.id } });
    if (!expense) return notFound();
    if (!b || typeof b !== "object" || !("esf" in b)) return badRequest("Nothing to update");
    const t = (x: unknown, max: number) => (typeof x === "string" ? x.replace(/[\p{Cc}<>]/gu, " ").trim().slice(0, max) : "");
    const raw = (b as { esf: unknown }).esf as { number?: unknown; date?: unknown; supplierInn?: unknown } | null;
    const esf = raw && typeof raw === "object" ? { number: t(raw.number, 60), date: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date ?? "")) ? String(raw.date) : "", supplierInn: t(raw.supplierInn, 20) } : null;
    await prisma.expense.update({ where: { id: expense.id }, data: { esf: (esf && esf.number ? esf : null) as never } });
    return NextResponse.json({ esf: esf && esf.number ? esf : null });
}
