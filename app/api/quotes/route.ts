import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, validId } from "@/lib/api";
import { nextNumber } from "@/lib/finance/numbering";
import { financeSettings, defaultCurrency } from "@/lib/finance/settings";
import { cleanItems } from "@/lib/finance/totals";
import { applyTaxPolicy } from "@/lib/finance/tax";
import { toQuoteDTO } from "@/lib/finance/dto";
import { isTemplate } from "@/lib/finance/pdf";
import { ownedContact, ownedCompany, ownedDeal, contactForCustomer, dealForCustomer } from "@/lib/deals";
import { prisma } from "@/lib/prisma";
import { logDocEvent } from "@/lib/sync/documents";
import { numberPrefix } from "@/lib/finance/documents/store";

export const dynamic = "force-dynamic";

// GET /api/quotes?status=&deal= — коммерческие предложения (Angebot), самые новые первыми; deal= для показа
// предложений сделки прямо в её карточке (CRM → Deal → Quotes)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const deal = url.searchParams.get("deal");
    const filter: Record<string, unknown> = { org: user.id };
    if (status) filter.status = status;
    if (deal) filter.deal = validId(deal) ? deal : "__none__"; // невалидный id — пустой результат, не ошибка
    const list = await prisma.quote.findMany({ where: filter as any, orderBy: { createdAt: "desc" }, take: 300 });
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
    const [settings, author, contact, company, deal] = await Promise.all([
        financeSettings(user.id), prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } }),
        ownedContact(b.contact, user.id), ownedCompany(b.company, user.id), ownedDeal(b.deal, user.id),
    ]);
    // ставку определяет фирма, а не браузер: освобождённая — 0 % во всех строках, иначе страна по умолчанию
    const items = applyTaxPolicy(rawItems, settings);
    const number = await nextNumber(user.id, await numberPrefix(user.id, "quote", settings.quotePrefix || "AN"));
    const today = new Date().toISOString().slice(0, 10);
    const validUntil = typeof b.validUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.validUntil) ? b.validUntil : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    // Клиент текстом без карточки: точное имя контакта — привязываем; нового клиента — заводим карточку
    const linkedContact = contact || (await contactForCustomer(user.id, { contact: b.contact, company: b.company, customerName }));
    const quote = await prisma.quote.create({
        data: {
            org: user.id, number, customerName, items: items as any,
            contact: linkedContact ?? undefined, company: company ?? undefined, deal: (deal || (await dealForCustomer(user.id, linkedContact, company, customerName))) ?? undefined,
            currency: typeof b.currency === "string" && b.currency.trim() ? b.currency.trim().slice(0, 6).toUpperCase() : await defaultCurrency(user.id),
            issueDate: typeof b.issueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.issueDate) ? b.issueDate : today,
            validUntil,
            notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : "",
            template: isTemplate(b.template) ? b.template : "",
            createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        },
    });
    await logDocEvent(user.id, quote, "quote", `Предложение ${quote.number} создано`, "created");
    return NextResponse.json(toQuoteDTO(quote), { status: 201 });
}
