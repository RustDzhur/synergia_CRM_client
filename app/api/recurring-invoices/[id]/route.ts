import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { cleanItems } from "@/lib/finance/totals";
import { toRecurringInvoiceDTO } from "@/lib/finance/dto";
import { prisma } from "@/lib/prisma";

// PATCH /api/recurring-invoices/:id — правка шаблона (позиции, расписание, включить/выключить); nextRunDate можно
// переставить вручную (например поставить на паузу и потом задать дату возобновления)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    const r = await prisma.recurringInvoice.findFirst({ where: { id: params.id, org: user.id } });
    if (!r) return notFound();
    const data: Record<string, unknown> = {};
    if (b.items !== undefined) { const items = cleanItems(b.items); if (!items.length) return badRequest("At least one line item is required"); data.items = items; }
    if (typeof b.customerName === "string" && b.customerName.trim()) data.customerName = b.customerName.trim().slice(0, 200);
    if (typeof b.customerAddress === "string") data.customerAddress = b.customerAddress.trim().slice(0, 500);
    if (typeof b.customerTaxId === "string") data.customerTaxId = b.customerTaxId.trim().slice(0, 60);
    if (typeof b.notes === "string") data.notes = b.notes.trim().slice(0, 2000);
    if (b.interval === "monthly" || b.interval === "yearly") data.interval = b.interval;
    if (Number.isFinite(Number(b.dayOfMonth))) data.dayOfMonth = Math.min(28, Math.max(1, Math.round(Number(b.dayOfMonth))));
    if (typeof b.autoSend === "boolean") data.autoSend = b.autoSend;
    if (typeof b.active === "boolean") data.active = b.active;
    if (typeof b.nextRunDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.nextRunDate)) data.nextRunDate = b.nextRunDate;
    const saved = await prisma.recurringInvoice.update({ where: { id: r.id }, data: data as any });
    return NextResponse.json(toRecurringInvoiceDTO(saved));
}

// DELETE /api/recurring-invoices/:id — удаляет только шаблон; уже созданные им счета остаются как есть
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const r = await prisma.recurringInvoice.deleteMany({ where: { id: params.id, org: user.id } });
    return r.count ? NextResponse.json({ ok: true }) : notFound();
}
