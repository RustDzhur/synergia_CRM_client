import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { nextNumber } from "@/lib/finance/numbering";
import { financeSettings } from "@/lib/finance/settings";
import { cleanItems, computeTotals } from "@/lib/finance/totals";
import { applyTaxPolicy } from "@/lib/finance/tax";
import { toQuoteDTO } from "@/lib/finance/dto";
import { isTemplate } from "@/lib/finance/pdf";
import { ownedContact, ownedCompany, ownedDeal } from "@/lib/deals";
import Quote from "@/models/Quote";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET /api/quotes?status=&deal= — коммерческие предложения (Angebot), самые новые первыми; deal= для показа
// предложений сделки прямо в её карточке (CRM → Deal → Quotes)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const deal = url.searchParams.get("deal");
    const filter: Record<string, unknown> = { org: user.id };
    if (status) filter.status = status;
    if (deal) filter.deal = isValidObjectId(deal) ? deal : "__none__"; // невалидный id — пустой результат, не ошибка
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
    const rawItems = cleanItems(b.items);
    if (!rawItems.length) return badRequest("At least one line item is required");
    await connectDB();
    const [settings, author, contact, company, deal] = await Promise.all([
        financeSettings(user.id), User.findById(user.userId).select("firstname lastname"),
        ownedContact(b.contact, user.id), ownedCompany(b.company, user.id), ownedDeal(b.deal, user.id),
    ]);
    // ставку определяет фирма, а не браузер: освобождённая — 0 % во всех строках, иначе страна по умолчанию
    const items = applyTaxPolicy(rawItems, settings);
    const number = await nextNumber(user.id, settings.quotePrefix || "AN");
    const today = new Date().toISOString().slice(0, 10);
    const validUntil = typeof b.validUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.validUntil) ? b.validUntil : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const quote = await Quote.create({
        org: user.id, number, customerName, items,
        contact: contact || undefined, company: company || undefined, deal: deal || undefined,
        currency: typeof b.currency === "string" && b.currency.trim() ? b.currency.trim().slice(0, 6).toUpperCase() : "EUR",
        issueDate: typeof b.issueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.issueDate) ? b.issueDate : today,
        validUntil,
        notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : "",
        template: isTemplate(b.template) ? b.template : "",
        createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
    });
    return NextResponse.json(toQuoteDTO(quote), { status: 201 });
}
