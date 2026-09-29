import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { applyPayment, statusAfterPayment } from "@/lib/finance/payments";
import { computeTotals } from "@/lib/finance/totals";
import Invoice from "@/models/Invoice";
import { toInvoiceDTO } from "@/lib/finance/dto";

// POST /api/invoices/:id/pay — { amount? }: отметить оплату (без amount — вся сумма, с amount — частично).
// Оплата фиксируется вручную: деньги приходят переводом или наличными, а в CRM их вносят человек
// или сверка с банком (app/api/bank/transactions). Подписки на тарифы оплачиваются отдельно, через Stripe.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const inv = await Invoice.findOne({ _id: params.id, org: user.id });
    if (!inv) return notFound();
    if (!["sent", "overdue"].includes(inv.status)) return badRequest("Only a sent (or overdue) invoice can be marked paid");
    const b = await req.json().catch(() => ({}));
    const { gross } = computeTotals(inv.items as never);
    const amount = Number.isFinite(Number(b.amount)) ? Math.max(0, Number(b.amount)) : gross;
    const { paid, full } = applyPayment(inv, amount);
    inv.paidAmount = paid;
    inv.status = statusAfterPayment(inv.status, full);
    if (full) inv.paidAt = new Date();
    await inv.save();
    // Событие автоматизации — только по полной оплате: правило на «счёт оплачен» не должно срабатывать
    // на аванс. Частичная оплата видна в самом счёте и в журнале действий.
    if (full) {
        await emit(user.id, { type: "invoice_paid", data: { id: String(inv._id), number: inv.number, customerName: inv.customerName, amount: String(amount), dealId: inv.deal ? String(inv.deal) : "" } });
    }
    await logAudit({ org: user.id, userId: user.userId, action: full ? "invoice.paid" : "invoice.partially_paid", entityType: "invoice", entityId: String(inv._id), summary: `Invoice ${inv.number}: ${amount} ${inv.currency} booked — ${paid} of ${gross} paid`, meta: { amount, paid, gross, currency: inv.currency } });
    return NextResponse.json(toInvoiceDTO(inv));
}
