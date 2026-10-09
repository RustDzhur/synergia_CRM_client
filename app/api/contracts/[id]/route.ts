import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { toContractDTO } from "@/lib/finance/dto";
import { isTemplate } from "@/lib/finance/pdf";
import { ownedContact, ownedCompany } from "@/lib/deals";
import { prisma } from "@/lib/prisma";
import { cleanBody } from "@/lib/finance/contractHtml";

// завершённый/отменённый договор уже мог породить события/заказы — не редактируется, только для истории
const LOCKED = ["completed", "cancelled"];

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const c = await prisma.contract.findUnique({ where: { id: params.id } });
    return c && c.org === user.id ? NextResponse.json(toContractDTO(c)) : notFound();
}

// PATCH /api/contracts/:id — { customerName?, value?, startDate?, endDate?, notes?, body?, contact?, company?, file? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    const contract = await prisma.contract.findUnique({ where: { id: params.id } });
    if (!contract || contract.org !== user.id) return notFound();
    if (LOCKED.includes(contract.status)) return badRequest("This contract is completed or cancelled and can no longer be edited");

    const data: Record<string, any> = {};
    if (typeof b.customerName === "string" && b.customerName.trim()) data.customerName = b.customerName.trim().slice(0, 200);
    if (b.value !== undefined) data.value = Math.max(0, Number(b.value) || 0);
    if (typeof b.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.startDate)) data.startDate = b.startDate;
    if (typeof b.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.endDate)) data.endDate = b.endDate;
    if (typeof b.notes === "string") data.notes = b.notes.trim().slice(0, 2000);
    // Текст договора и привязка к клиенту из CRM — правятся и после создания
    if (typeof b.body === "string") data.body = cleanBody(b.body);
    if (b.contact !== undefined) data.contact = (await ownedContact(b.contact, user.id)) ?? undefined;
    if (b.company !== undefined) data.company = (await ownedCompany(b.company, user.id)) ?? undefined;
    // пустая строка — «печатать оформление из настроек бухгалтерии», поэтому её тоже принимаем
    if (b.template === "") data.template = "";
    else if (isTemplate(b.template)) data.template = b.template;
    if (typeof b.templateId === "string") data.templateId = b.templateId.trim() ? b.templateId.trim().slice(0, 40) : null;
    if (b.fields && typeof b.fields === "object" && !Array.isArray(b.fields)) data.fields = b.fields;
    if (typeof b.file === "string" && b.file) data.file = b.file;
    const updated = await prisma.contract.update({ where: { id: params.id }, data });
    return NextResponse.json(toContractDTO(updated));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const r = await prisma.contract.deleteMany({ where: { id: params.id, org: user.id, status: "draft" } });
    return r.count ? NextResponse.json({ ok: true }) : notFound();
}
