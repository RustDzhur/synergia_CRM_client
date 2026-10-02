import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
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
