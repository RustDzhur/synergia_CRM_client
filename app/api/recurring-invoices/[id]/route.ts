import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { cleanItems } from "@/lib/finance/totals";
import { toRecurringInvoiceDTO } from "@/lib/finance/dto";
import RecurringInvoice from "@/models/RecurringInvoice";

// PATCH /api/recurring-invoices/:id — правка шаблона (позиции, расписание, включить/выключить); nextRunDate можно
// переставить вручную (например поставить на паузу и потом задать дату возобновления)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    await connectDB();
    const r = await RecurringInvoice.findOne({ _id: params.id, org: user.id });
    if (!r) return notFound();
    if (b.items !== undefined) { const items = cleanItems(b.items); if (!items.length) return badRequest("At least one line item is required"); r.items = items as any; }
    if (typeof b.customerName === "string" && b.customerName.trim()) r.customerName = b.customerName.trim().slice(0, 200);
    if (typeof b.customerAddress === "string") r.customerAddress = b.customerAddress.trim().slice(0, 500);
    if (typeof b.customerTaxId === "string") r.customerTaxId = b.customerTaxId.trim().slice(0, 60);
    if (typeof b.notes === "string") r.notes = b.notes.trim().slice(0, 2000);
    if (b.interval === "monthly" || b.interval === "yearly") r.interval = b.interval;
    if (Number.isFinite(Number(b.dayOfMonth))) r.dayOfMonth = Math.min(28, Math.max(1, Math.round(Number(b.dayOfMonth))));
    if (typeof b.autoSend === "boolean") r.autoSend = b.autoSend;
    if (typeof b.active === "boolean") r.active = b.active;
    if (typeof b.nextRunDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.nextRunDate)) r.nextRunDate = b.nextRunDate;
    await r.save();
    return NextResponse.json(toRecurringInvoiceDTO(r));
}

// DELETE /api/recurring-invoices/:id — удаляет только шаблон; уже созданные им счета остаются как есть
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const r = await RecurringInvoice.deleteOne({ _id: params.id, org: user.id });
    return r.deletedCount ? NextResponse.json({ ok: true }) : notFound();
}
