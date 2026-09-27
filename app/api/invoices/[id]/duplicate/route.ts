import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { nextNumber } from "@/lib/finance/numbering";
import { financeSettings } from "@/lib/finance/settings";
import Invoice from "@/models/Invoice";
import { isTemplate } from "@/lib/finance/pdf";
import { toInvoiceDTO } from "@/lib/finance/dto";

// POST /api/invoices/:id/duplicate — новый черновик с теми же клиентом и позициями (повторный/шаблонный счёт без
// отдельной модели шаблонов: любой существующий счёт можно переиспользовать как основу).
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const source = await Invoice.findOne({ _id: params.id, org: user.id });
    if (!source) return notFound();
    if (source.kind !== "invoice") return badRequest("A credit note cannot be duplicated");

    const settings = await financeSettings(user.id);
    const number = await nextNumber(user.id, settings.invoicePrefix || "RE");
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + (settings.paymentTermsDays ?? 14) * 86400000).toISOString().slice(0, 10);
    const copy = await Invoice.create({
        org: user.id, number, kind: "invoice",
        contact: source.contact, company: source.company,
        customerName: source.customerName, customerAddress: source.customerAddress, customerTaxId: source.customerTaxId,
        items: source.items, currency: source.currency, smallBusinessNote: source.smallBusinessNote,
        issueDate: today, dueDate: due, notes: source.notes, template: source.template,
    });
    return NextResponse.json(toInvoiceDTO(copy), { status: 201 });
}
