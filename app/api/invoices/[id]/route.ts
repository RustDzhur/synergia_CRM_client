import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { cleanItems } from "@/lib/finance/totals";
import { toInvoiceDTO } from "@/lib/finance/dto";
import { isTemplate } from "@/lib/finance/pdf";
import { prisma } from "@/lib/prisma";
import { withPeriodLock } from "@/lib/finance/periodLock";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const inv = await prisma.invoice.findUnique({ where: { id: params.id } });
    return inv && inv.org === user.id ? NextResponse.json(toInvoiceDTO(inv)) : notFound();
}

// PATCH /api/invoices/:id — правка возможна, только пока счёт "draft" (выданный номер уже не переиспользуется,
// но отправленный клиенту счёт содержимое не меняет — это отдельный документ, законность номера того требует)
async function handlePATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    const inv = await prisma.invoice.findUnique({ where: { id: params.id } });
    if (!inv || inv.org !== user.id) return notFound();
    if (inv.status !== "draft") return badRequest("Only a draft invoice can be edited");
    const data: Record<string, any> = {};
    if (b.items !== undefined) { const items = cleanItems(b.items); if (!items.length) return badRequest("At least one line item is required"); data.items = items; }
    if (typeof b.customerName === "string" && b.customerName.trim()) data.customerName = b.customerName.trim().slice(0, 200);
    if (typeof b.customerAddress === "string") data.customerAddress = b.customerAddress.trim().slice(0, 500);
    if (typeof b.customerTaxId === "string") data.customerTaxId = b.customerTaxId.trim().slice(0, 60);
    if (typeof b.notes === "string") data.notes = b.notes.trim().slice(0, 2000);
    // пустая строка — «печатать оформление из настроек бухгалтерии», поэтому её тоже принимаем
    if (b.template === "") data.template = "";
    else if (isTemplate(b.template)) data.template = b.template;
    if (typeof b.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)) data.dueDate = b.dueDate;
    // Дата/период оказания услуг (§14 Abs. 4 Nr. 6 UStG); пустая строка стирает поле — в черновике дату надо уметь и убрать
    if (typeof b.supplyDate === "string" && (b.supplyDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(b.supplyDate))) data.supplyDate = b.supplyDate;
    if (typeof b.supplyPeriodFrom === "string" && (b.supplyPeriodFrom === "" || /^\d{4}-\d{2}-\d{2}$/.test(b.supplyPeriodFrom))) data.supplyPeriodFrom = b.supplyPeriodFrom;
    if (typeof b.supplyPeriodTo === "string" && (b.supplyPeriodTo === "" || /^\d{4}-\d{2}-\d{2}$/.test(b.supplyPeriodTo))) data.supplyPeriodTo = b.supplyPeriodTo;
    const updated = await prisma.invoice.update({ where: { id: params.id }, data });
    return NextResponse.json(toInvoiceDTO(updated));
}

// DELETE /api/invoices/:id — только черновик; отправленный счёт лучше отменить (credit note), не удалить — номер не пропадает
async function handleDELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const r = await prisma.invoice.deleteMany({ where: { id: params.id, org: user.id, status: "draft" } });
    return r.count ? NextResponse.json({ ok: true }) : notFound();
}

// Закрытый период (сторож в lib/prisma.ts) отвечает здесь 423, а не «Server error»
export const PATCH = withPeriodLock(handlePATCH);
export const DELETE = withPeriodLock(handleDELETE);
