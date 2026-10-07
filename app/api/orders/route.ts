import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { nextNumber } from "@/lib/finance/numbering";
import { cleanItems, computeTotals } from "@/lib/finance/totals";
import { applyTaxPolicy } from "@/lib/finance/tax";
import { financeSettings, defaultCurrency } from "@/lib/finance/settings";
import { firmRate } from "@/lib/finance/rates";
import { toOrderDTO } from "@/lib/finance/dto";
import { isTemplate } from "@/lib/finance/pdf";
import { ownedContact, ownedCompany, ownedDeal, ownedContract, contactForCustomer, dealForCustomer } from "@/lib/deals";
import { prisma } from "@/lib/prisma";
import { logDocEvent } from "@/lib/sync/documents";
import { fx } from "@/lib/sync/texts";

export const dynamic = "force-dynamic";

// GET /api/orders?status= — список заказов фирмы, самые новые первыми
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const status = new URL(req.url).searchParams.get("status");
    const filter: Record<string, unknown> = { org: user.id };
    if (status) filter.status = status;
    const list = await prisma.order.findMany({ where: filter as any, orderBy: { createdAt: "desc" }, take: 300 });
    // Телефон клиента подтягиваем из связанных контактов одним запросом: он подставляется в окно ТТН,
    // чтобы менеджер не искал его в карточке (заказы хранят только ссылку на контакт)
    const contactIds = list.map((o) => o.contact).filter((c): c is string => !!c);
    const phones = new Map<string, string>();
    if (contactIds.length) {
        const contacts = await prisma.contact.findMany({ where: { id: { in: contactIds }, owner: user.id }, select: { id: true, phone: true } });
        for (const c of contacts) phones.set(c.id, String(c.phone ?? ""));
    }
    return NextResponse.json(
        list.map((o) => {
            const dto = toOrderDTO(o) as Record<string, unknown>;
            dto.contactPhone = o.contact ? phones.get(o.contact) ?? "" : "";
            return dto;
        })
    );
}

// POST /api/orders — создать заказ (сообщает автоматизации "order_created", от него можно завести уведомление
// «подготовить предложение» и т.п. — как у deal_created)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const customerName = typeof b?.customerName === "string" ? b.customerName.trim().slice(0, 200) : "";
    if (!customerName) return badRequest("customerName is required");
    const rawItems = cleanItems(b.items);
    const [number, author, contact, company, deal, contract, settings] = await Promise.all([
        nextNumber(user.id, "SO"), prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } }),
        ownedContact(b.contact, user.id), ownedCompany(b.company, user.id), ownedDeal(b.deal, user.id), ownedContract(b.contract, user.id),
        financeSettings(user.id),
    ]);
    // ставку определяет фирма, а не браузер: освобождённая — 0 % во всех строках, иначе страна по умолчанию
    const items = applyTaxPolicy(rawItems, settings);
    const currency = typeof b.currency === "string" && b.currency.trim() ? b.currency.trim().slice(0, 6).toUpperCase() : await defaultCurrency(user.id);
    // Курс НБУ на дату заказа — снимок, как и в счёте (см. app/api/invoices)
    const rate = currency === "UAH" ? { base: 0, margin: 0, value: 0, at: "" } : await firmRate(user.id, currency).then((r) => (r ? { base: r.base, margin: r.margin, value: r.rate, at: r.at } : { base: 0, margin: 0, value: 0, at: "" })).catch(() => ({ base: 0, margin: 0, value: 0, at: "" }));
    // Клиент текстом без карточки: точное имя контакта — привязываем; нового клиента — заводим карточку
    const linkedContact = contact || (await contactForCustomer(user.id, { contact: b.contact, company: b.company, customerName }));
    const order = await prisma.order.create({
        data: {
            org: user.id, number, customerName, items: items as any,
            contact: linkedContact ?? undefined, company: company ?? undefined, deal: (deal || (await dealForCustomer(user.id, linkedContact, company, customerName))) ?? undefined, contract: contract ?? undefined,
            currency,
            rate: rate as any,
            notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : "",
            template: isTemplate(b.template) ? b.template : "",
            responsible: typeof b.responsible === "string" ? b.responsible.trim().slice(0, 120) : "",
            createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        },
    });
    const totals = computeTotals(order.items as any);
    await logDocEvent(user.id, order, "order", fx("order_created", { number: order.number, amount: totals.gross, currency: order.currency }), "created");
    await emit(user.id, { type: "order_created", data: { id: order.id, number: order.number, customerName: order.customerName, total: String(totals.gross), currency: order.currency } });
    return NextResponse.json(toOrderDTO(order), { status: 201 });
}
