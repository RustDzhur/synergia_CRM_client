import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { applyPayment, statusAfterPayment } from "@/lib/finance/payments";
import { computeTotals } from "@/lib/finance/totals";
import { ensureSupplyDate } from "@/lib/finance/issue";
import { prisma } from "@/lib/prisma";
import { toInvoiceDTO } from "@/lib/finance/dto";
import { fiscalAdvice, fiscalConfig, fiscalizeInvoice, findFiscal } from "@/lib/finance/fiscal";

// POST /api/invoices/:id/pay — { amount? }: «деньги поступили» (без amount — вся сумма, с amount — частично). Работает для черновика, отправленного и просроченного счёта.
// Оплата фиксируется вручную: деньги приходят переводом или наличными, а в CRM их вносят человек
// или сверка с банком (app/api/bank/transactions). Тарифы платформы оплачиваются отдельно, переводом (lib/transferPay.ts).
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    let inv = await prisma.invoice.findFirst({ where: { id: params.id, org: user.id } });
    if (!inv) return notFound();
    // Оплата не зависит от отправки: деньги могли прийти и по счёту, отданному клиенту другим путём, — закрыть можно и черновик
    if (!["draft", "sent", "overdue"].includes(inv.status)) return badRequest("Only an open invoice (draft, sent or overdue) can be marked paid");
    if (inv.status === "draft") inv = await ensureSupplyDate(inv);
    const b = await req.json().catch(() => ({}));
    const { gross } = computeTotals(inv.items as never);
    const amount = Number.isFinite(Number(b.amount)) ? Math.max(0, Number(b.amount)) : gross;
    const { paid, full } = applyPayment(inv, amount);
    inv = await prisma.invoice.update({
        where: { id: inv.id },
        data: { paidAmount: paid, status: statusAfterPayment(inv.status, full), ...(full ? { paidAt: new Date() } : {}) },
    });
    // Событие автоматизации — только по полной оплате: правило на «счёт оплачен» не должно срабатывать
    // на аванс. Частичная оплата видна в самом счёте и в журнале действий.
    if (full) {
        await emit(user.id, { type: "invoice_paid", data: { id: inv.id, number: inv.number, customerName: inv.customerName, amount: String(amount), dealId: inv.deal ?? "" } });
    }
    // ПРРО (Украина): при полной оплате чек пробивается сам — если Checkbox подключён, включена
    // автофискализация и чек по правилам нужен. Ошибку показываем в счёте, оплату не отменяем.
    if (full && !inv.fiscalCode) {
        let fiscalData: Record<string, any> = {};
        try {
            const advice = fiscalAdvice(inv);
            const fiscalDoc = advice.needed ? await findFiscal(user.id) : null;
            if (fiscalDoc && fiscalConfig(fiscalDoc).auto) {
                const receipt = await fiscalizeInvoice(user.id, inv, gross, advice.payType);
                fiscalData = { fiscalId: receipt.receiptId, fiscalCode: receipt.fiscalCode, fiscalUrl: receipt.url, fiscalAt: new Date(), fiscalPayType: advice.payType, fiscalError: "" };
            }
        } catch (e) {
            fiscalData = { fiscalError: e instanceof Error ? e.message.slice(0, 300) : "Чек не вдалося пробити" };
        }
        if (Object.keys(fiscalData).length) inv = await prisma.invoice.update({ where: { id: inv.id }, data: fiscalData });
    }
    await logAudit({ org: user.id, userId: user.userId, action: full ? "invoice.paid" : "invoice.partially_paid", entityType: "invoice", entityId: inv.id, summary: `Invoice ${inv.number}: ${amount} ${inv.currency} booked — ${paid} of ${gross} paid`, meta: { amount, paid, gross, currency: inv.currency } });
    return NextResponse.json(toInvoiceDTO(inv));
}
