import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { cleanItems } from "@/lib/finance/totals";
import { applyTaxPolicy } from "@/lib/finance/tax";
import { financeSettings } from "@/lib/finance/settings";
import { toQuoteDTO } from "@/lib/finance/dto";
import { isTemplate } from "@/lib/finance/pdf";
import { prisma } from "@/lib/prisma";

// решение (принято/отклонено/просрочено) уже зафиксировано — редактировать нельзя, только черновик и отправленное
const LOCKED = ["accepted", "declined", "expired"];

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const q = await prisma.quote.findUnique({ where: { id: params.id } });
    return q && q.org === user.id ? NextResponse.json(toQuoteDTO(q)) : notFound();
}

// PATCH /api/quotes/:id — { items?, customerName?, validUntil?, notes? }. Только пока предложение draft или sent.
// Если items и/или customerName реально меняются — текущее состояние сохраняется как версия перед правкой (Quote v1,
// v2, v3…), а не молча перезаписывается: коммерческое предложение — не черновик заметки, история должна остаться.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    const quote = await prisma.quote.findUnique({ where: { id: params.id } });
    if (!quote || quote.org !== user.id) return notFound();
    if (LOCKED.includes(quote.status)) return badRequest("This quote already has a final decision and can no longer be edited");

    let newItems: any[] | undefined;
    if (b.items !== undefined) {
        // правка строк подчиняется текущей налоговой политике фирмы, как и создание
        const items = applyTaxPolicy(cleanItems(b.items), await financeSettings(user.id));
        if (!items.length) return badRequest("At least one line item is required");
        newItems = items as any;
    }
    const newCustomerName = typeof b.customerName === "string" && b.customerName.trim() ? b.customerName.trim().slice(0, 200) : undefined;

    const itemsChanged = newItems !== undefined && JSON.stringify(newItems) !== JSON.stringify(quote.items);
    const nameChanged = newCustomerName !== undefined && newCustomerName !== quote.customerName;

    const data: Record<string, any> = {};
    if (newItems !== undefined) data.items = newItems;
    if (newCustomerName !== undefined) data.customerName = newCustomerName;
    if (typeof b.validUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.validUntil)) data.validUntil = b.validUntil;
    if (typeof b.notes === "string") data.notes = b.notes.trim().slice(0, 2000);
    // пустая строка — «печатать оформление из настроек бухгалтерии», поэтому её тоже принимаем
    if (b.template === "") data.template = "";
    else if (isTemplate(b.template)) data.template = b.template;
    if (itemsChanged || nameChanged) {
        const versions = Array.isArray(quote.versions) ? quote.versions : [];
        versions.push({ version: quote.version, items: quote.items, customerName: quote.customerName, currency: quote.currency, savedAt: new Date().toISOString() });
        data.versions = versions;
        data.version = (Number(quote.version) || 0) + 1;
    }
    const updated = await prisma.quote.update({ where: { id: params.id }, data });
    return NextResponse.json(toQuoteDTO(updated));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const r = await prisma.quote.deleteMany({ where: { id: params.id, org: user.id, status: "draft" } });
    return r.count ? NextResponse.json({ ok: true }) : notFound();
}
