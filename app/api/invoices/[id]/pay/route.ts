import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { computeTotals } from "@/lib/finance/totals";
import Invoice from "@/models/Invoice";
import { toInvoiceDTO } from "../../route";

// POST /api/invoices/:id/pay — { amount? }: отметить оплаченным (полностью или частично — amount по умолчанию вся сумма).
// Оплата фиксируется вручную (банковский перевод, Stripe и т.п. подключаются позже) — это не автоматическое списание.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const inv = await Invoice.findOne({ _id: params.id, org: user.id });
    if (!inv) return notFound();
    if (!["sent", "overdue"].includes(inv.status)) return badRequest("Only a sent (or overdue) invoice can be marked paid");
    const b = await req.json().catch(() => ({}));
    const { gross } = computeTotals(inv.items as any);
    const amount = Number.isFinite(Number(b.amount)) ? Math.max(0, Number(b.amount)) : gross;
    inv.status = "paid";
    inv.paidAt = new Date();
    inv.paidAmount = amount;
    await inv.save();
    await emit(user.id, { type: "invoice_paid", data: { id: String(inv._id), number: inv.number, customerName: inv.customerName, amount: String(amount), dealId: inv.deal ? String(inv.deal) : "" } });
    await logAudit({ org: user.id, userId: user.userId, action: "invoice.paid", entityType: "invoice", entityId: String(inv._id), summary: `Invoice ${inv.number} marked paid — ${amount} ${inv.currency}`, meta: { amount, currency: inv.currency } });
    return NextResponse.json(toInvoiceDTO(inv));
}
