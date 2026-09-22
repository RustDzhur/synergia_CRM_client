import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { nextNumber } from "@/lib/finance/numbering";
import { financeSettings } from "@/lib/finance/settings";
import { cleanItems, computeTotals } from "@/lib/finance/totals";
import Quote from "@/models/Quote";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export const toQuoteDTO = (q: any) => ({
    id: String(q._id), number: q.number, status: q.status,
    contact: q.contact ? String(q.contact) : "", company: q.company ? String(q.company) : "", customerName: q.customerName,
    deal: q.deal ? String(q.deal) : "", order: q.order ? String(q.order) : "",
    items: (q.items ?? []).map((it: any) => ({ description: it.description, qty: it.qty, unitPrice: it.unitPrice, taxRate: it.taxRate, product: it.product ? String(it.product) : "" })),
    currency: q.currency, issueDate: q.issueDate, validUntil: q.validUntil, notes: q.notes,
    sentAt: q.sentAt ? q.sentAt.toISOString() : "",
    totals: computeTotals(q.items ?? []),
    createdAt: q.createdAt.toISOString(), updatedAt: q.updatedAt.toISOString(),
});

// GET /api/quotes?status= — коммерческие предложения (Angebot), самые новые первыми
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const status = new URL(req.url).searchParams.get("status");
    const filter: Record<string, unknown> = { org: user.id };
    if (status) filter.status = status;
    const list = await Quote.find(filter).sort({ createdAt: -1 }).limit(300);
    return NextResponse.json(list.map(toQuoteDTO));
}

// POST /api/quotes — черновик предложения; номер вида AN-2026-1 (префикс настраивается в Finance → Settings)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const customerName = typeof b?.customerName === "string" ? b.customerName.trim().slice(0, 200) : "";
    if (!customerName) return badRequest("customerName is required");
    const items = cleanItems(b.items);
    if (!items.length) return badRequest("At least one line item is required");
    await connectDB();
    const [settings, author] = await Promise.all([financeSettings(user.id), User.findById(user.userId).select("firstname lastname")]);
    const number = await nextNumber(user.id, settings.quotePrefix || "AN");
    const today = new Date().toISOString().slice(0, 10);
    const validUntil = typeof b.validUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.validUntil) ? b.validUntil : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const quote = await Quote.create({
        org: user.id, number, customerName, items,
        contact: b.contact || undefined, company: b.company || undefined, deal: b.deal || undefined,
        currency: typeof b.currency === "string" && b.currency.trim() ? b.currency.trim().slice(0, 6).toUpperCase() : "EUR",
        issueDate: typeof b.issueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.issueDate) ? b.issueDate : today,
        validUntil,
        notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : "",
        createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
    });
    return NextResponse.json(toQuoteDTO(quote), { status: 201 });
}
