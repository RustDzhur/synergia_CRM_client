import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { nextNumber } from "@/lib/finance/numbering";
import { financeSettings } from "@/lib/finance/settings";
import { cleanItems } from "@/lib/finance/totals";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import Invoice from "@/models/Invoice";
import { toInvoiceDTO } from "@/lib/finance/dto";

// POST /api/invoices/:id/credit-note — { items?, notes? }: выпускает кредит-ноту (Gutschrift/storno) к отправленному
// счёту. Номер счёта, однажды выданный, не меняется и не удаляется (§14 UStG) — корректировка оформляется отдельным
// документом со своей нумерацией (creditNotePrefix), который эту сумму вычитает. Без items — зеркалит позиции исходного
// счёта с отрицательной ценой (полная отмена); свои items — частичная или произвольная корректировка.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const source = await Invoice.findOne({ _id: params.id, org: user.id });
    if (!source) return notFound();
    if (source.kind !== "invoice") return badRequest("Only an invoice can be credited");
    if (!["sent", "paid", "overdue"].includes(source.status)) return badRequest("Only a sent, paid or overdue invoice can be credited");

    const b = await req.json().catch(() => ({}));
    let items = cleanItems(b.items);
    if (!items.length) {
        items = (source.items as any[]).map((it) => ({ description: it.description, qty: it.qty, unitPrice: -Math.abs(it.unitPrice), taxRate: it.taxRate, product: it.product }));
    }

    const settings = await financeSettings(user.id);
    const number = await nextNumber(user.id, settings.creditNotePrefix || "GS");
    const today = new Date().toISOString().slice(0, 10);
    const credit = await Invoice.create({
        org: user.id, number, kind: "credit_note", creditFor: source._id,
        contact: source.contact, company: source.company,
        customerName: source.customerName, customerAddress: source.customerAddress, customerTaxId: source.customerTaxId,
        deal: source.deal, order: source.order, contract: source.contract,
        items, currency: source.currency, smallBusinessNote: source.smallBusinessNote,
        issueDate: today, dueDate: "",
        notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : "",
        status: "sent", sentAt: new Date(),
    });
    await emit(user.id, { type: "invoice_credit_note_created", data: { id: String(credit._id), number: credit.number, customerName: credit.customerName, sourceInvoice: source.number } });
    await logAudit({ org: user.id, userId: user.userId, action: "invoice.credit_note", entityType: "invoice", entityId: String(credit._id), summary: `Credit note ${credit.number} issued for invoice ${source.number}`, meta: { sourceInvoice: source.number, currency: credit.currency } });
    return NextResponse.json(toInvoiceDTO(credit), { status: 201 });
}
