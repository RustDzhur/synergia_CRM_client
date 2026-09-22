import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { cleanItems } from "@/lib/finance/totals";
import Invoice from "@/models/Invoice";
import { toInvoiceDTO } from "../route";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const inv = await Invoice.findOne({ _id: params.id, org: user.id });
    return inv ? NextResponse.json(toInvoiceDTO(inv)) : notFound();
}

// PATCH /api/invoices/:id — правка возможна, только пока счёт "draft" (выданный номер уже не переиспользуется,
// но отправленный клиенту счёт содержимое не меняет — это отдельный документ, законность номера того требует)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    await connectDB();
    const inv = await Invoice.findOne({ _id: params.id, org: user.id });
    if (!inv) return notFound();
    if (inv.status !== "draft") return badRequest("Only a draft invoice can be edited");
    if (b.items !== undefined) { const items = cleanItems(b.items); if (!items.length) return badRequest("At least one line item is required"); inv.items = items as any; }
    if (typeof b.customerName === "string" && b.customerName.trim()) inv.customerName = b.customerName.trim().slice(0, 200);
    if (typeof b.customerAddress === "string") inv.customerAddress = b.customerAddress.trim().slice(0, 500);
    if (typeof b.customerTaxId === "string") inv.customerTaxId = b.customerTaxId.trim().slice(0, 60);
    if (typeof b.notes === "string") inv.notes = b.notes.trim().slice(0, 2000);
    if (typeof b.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)) inv.dueDate = b.dueDate;
    await inv.save();
    return NextResponse.json(toInvoiceDTO(inv));
}

// DELETE /api/invoices/:id — только черновик; отправленный счёт лучше отменить (credit note), не удалить — номер не пропадает
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const r = await Invoice.deleteOne({ _id: params.id, org: user.id, status: "draft" });
    return r.deletedCount ? NextResponse.json({ ok: true }) : notFound();
}
