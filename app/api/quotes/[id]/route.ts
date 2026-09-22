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
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    await connectDB();
    const quote = await Quote.findOne({ _id: params.id, org: user.id });
    if (!quote) return notFound();
    if (LOCKED.includes(quote.status)) return badRequest("This quote already has a final decision and can no longer be edited");

    if (b.items !== undefined) {
        const items = cleanItems(b.items);
        if (!items.length) return badRequest("At least one line item is required");
        quote.items = items as any;
    }
    if (typeof b.customerName === "string" && b.customerName.trim()) quote.customerName = b.customerName.trim().slice(0, 200);
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
