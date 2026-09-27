import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { cleanItems } from "@/lib/finance/totals";
import Quote from "@/models/Quote";
import { toQuoteDTO } from "@/lib/finance/dto";

// решение (принято/отклонено/просрочено) уже зафиксировано — редактировать нельзя, только черновик и отправленное
const LOCKED = ["accepted", "declined", "expired"];

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const q = await Quote.findOne({ _id: params.id, org: user.id });
    return q ? NextResponse.json(toQuoteDTO(q)) : notFound();
}

// PATCH /api/quotes/:id — { items?, customerName?, validUntil?, notes? }. Только пока предложение draft или sent.
// Если items и/или customerName реально меняются — текущее состояние сохраняется как версия перед правкой (Quote v1,
// v2, v3…), а не молча перезаписывается: коммерческое предложение — не черновик заметки, история должна остаться.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    await connectDB();
    const quote = await Quote.findOne({ _id: params.id, org: user.id });
    if (!quote) return notFound();
    if (LOCKED.includes(quote.status)) return badRequest("This quote already has a final decision and can no longer be edited");

    let newItems: typeof quote.items | undefined;
    if (b.items !== undefined) {
        const items = cleanItems(b.items);
        if (!items.length) return badRequest("At least one line item is required");
        newItems = items as any;
    }
    const newCustomerName = typeof b.customerName === "string" && b.customerName.trim() ? b.customerName.trim().slice(0, 200) : undefined;

    const itemsChanged = newItems !== undefined && JSON.stringify(newItems) !== JSON.stringify(quote.items);
    const nameChanged = newCustomerName !== undefined && newCustomerName !== quote.customerName;
    if (itemsChanged || nameChanged) {
        quote.versions.push({ version: quote.version, items: quote.items as any, customerName: quote.customerName, currency: quote.currency, savedAt: new Date() } as any);
        quote.version += 1;
    }
    if (newItems !== undefined) quote.items = newItems;
    if (newCustomerName !== undefined) quote.customerName = newCustomerName;
    if (typeof b.validUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.validUntil)) quote.validUntil = b.validUntil;
    if (typeof b.notes === "string") quote.notes = b.notes.trim().slice(0, 2000);
    await quote.save();
    return NextResponse.json(toQuoteDTO(quote));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const r = await Quote.deleteOne({ _id: params.id, org: user.id, status: "draft" });
    return r.deletedCount ? NextResponse.json({ ok: true }) : notFound();
}
