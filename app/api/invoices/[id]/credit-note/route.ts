import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { nextNumber } from "@/lib/finance/numbering";
import { financeSettings } from "@/lib/finance/settings";
import { cleanItems } from "@/lib/finance/totals";
import { applyTaxPolicy, taxExempt } from "@/lib/finance/tax";
import { fiscalConfig, fiscalizeReturn, findFiscal } from "@/lib/finance/fiscal";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { logDocEvent } from "@/lib/sync/documents";
import { isTemplate } from "@/lib/finance/pdf";
import { toInvoiceDTO } from "@/lib/finance/dto";
import { numberPrefix } from "@/lib/finance/documents/store";
import { fx } from "@/lib/sync/texts";

// POST /api/invoices/:id/credit-note — { items?, notes? }: выпускает кредит-ноту (Gutschrift/storno) к отправленному
// счёту. Номер счёта, однажды выданный, не меняется и не удаляется (§14 UStG) — корректировка оформляется отдельным
// документом со своей нумерацией (creditNotePrefix), который эту сумму вычитает.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const source = await prisma.invoice.findFirst({ where: { id: params.id, org: user.id } });
    if (!source) return notFound();
    if (source.kind !== "invoice") return badRequest("Only an invoice can be credited");
    if (!["sent", "paid", "overdue"].includes(source.status)) return badRequest("Only a sent, paid or overdue invoice can be credited");

    const b = await req.json().catch(() => ({}));
    let items = cleanItems(b.items);
    if (!items.length) {
        items = (source.items as any[]).map((it) => ({ description: it.description, qty: it.qty, unitPrice: -Math.abs(it.unitPrice), taxRate: it.taxRate, product: it.product }));
    }

    const settings = await financeSettings(user.id);
    const number = await nextNumber(user.id, await numberPrefix(user.id, "credit_note", settings.creditNotePrefix || "GS"));
    const today = new Date().toISOString().slice(0, 10);
    let credit = await prisma.invoice.create({
        data: {
            org: user.id, number, kind: "credit_note", creditFor: source.id,
            contact: source.contact, company: source.company,
            customerName: source.customerName, customerAddress: source.customerAddress, customerTaxId: source.customerTaxId,
            deal: source.deal, order: source.order, contract: source.contract,
            items: applyTaxPolicy(items, settings) as any, currency: source.currency, smallBusinessNote: taxExempt(settings),
            issueDate: today, dueDate: "",
            notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : "",
            // кредит-нота выглядит как исправляемый счёт, если в запросе не попросили другой шаблон
            template: isTemplate(b.template) ? b.template : source.template,
            status: "sent", sentAt: new Date(),
        },
    });
    // ПРРО: если по исходному счёту пробит чек продажи и включена автофискализация — пробиваем чек
    // возврата сразу (он ссылается на чек продажи). Ошибку храним в кредит-ноте, выпуск не отменяем.
    if (source.fiscalId) {
        let fiscalData: Record<string, any> = {};
        try {
            const fiscalDoc = await findFiscal(user.id);
            if (fiscalDoc && fiscalConfig(fiscalDoc).auto) {
                const receipt = await fiscalizeReturn(user.id, credit, undefined, "CARD");
                fiscalData = { fiscalReturnId: receipt.receiptId, fiscalReturnUrl: receipt.url, fiscalReturnCode: receipt.fiscalCode, fiscalReturnAt: new Date() };
            }
        } catch (e) {
            fiscalData = { fiscalReturnError: e instanceof Error ? e.message.slice(0, 300) : "Чек повернення не вдалося пробити" };
        }
        if (Object.keys(fiscalData).length) credit = await prisma.invoice.update({ where: { id: credit.id }, data: fiscalData });
    }
    await logDocEvent(user.id, credit, "invoice", fx("credit_note", { number: credit.number, source: source.number }), "created");
    await emit(user.id, { type: "invoice_credit_note_created", data: { id: credit.id, number: credit.number, customerName: credit.customerName, sourceInvoice: source.number } });
    await logAudit({ org: user.id, userId: user.userId, action: "invoice.credit_note", entityType: "invoice", entityId: credit.id, summary: `Credit note ${credit.number} issued for invoice ${source.number}`, meta: { sourceInvoice: source.number, currency: credit.currency } });
    return NextResponse.json(toInvoiceDTO(credit), { status: 201 });
}
