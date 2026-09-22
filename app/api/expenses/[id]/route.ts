import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import Expense from "@/models/Expense";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const expense = await Expense.findOneAndDelete({ _id: params.id, org: user.id });
    if (!expense) return notFound();
    await logAudit({ org: user.id, userId: user.userId, action: "expense.deleted", entityType: "expense", entityId: params.id, summary: `Expense ${expense.vendor} — ${expense.amount} ${expense.currency} — deleted`, meta: { amount: expense.amount, currency: expense.currency } });
    return NextResponse.json({ ok: true });
}
