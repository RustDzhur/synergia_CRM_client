import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { nextNumber } from "@/lib/finance/numbering";
import { cleanItems, computeTotals } from "@/lib/finance/totals";
import { applyTaxPolicy } from "@/lib/finance/tax";
import { financeSettings, defaultCurrency } from "@/lib/finance/settings";
import { toOrderDTO } from "@/lib/finance/dto";
import { isTemplate } from "@/lib/finance/pdf";
import { ownedContact, ownedCompany, ownedDeal, ownedContract, dealForCustomer } from "@/lib/deals";
import Order from "@/models/Order";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET /api/orders?status= — список заказов фирмы, самые новые первыми
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const status = new URL(req.url).searchParams.get("status");
    const filter: Record<string, unknown> = { org: user.id };
    if (status) filter.status = status;
    const list = await Order.find(filter).sort({ createdAt: -1 }).limit(300);
    return NextResponse.json(list.map(toOrderDTO));
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
    await connectDB();
    const [number, author, contact, company, deal, contract, settings] = await Promise.all([
        nextNumber(user.id, "SO"), User.findById(user.userId).select("firstname lastname"),
        ownedContact(b.contact, user.id), ownedCompany(b.company, user.id), ownedDeal(b.deal, user.id), ownedContract(b.contract, user.id),
        financeSettings(user.id),
    ]);
    // ставку определяет фирма, а не браузер: освобождённая — 0 % во всех строках, иначе страна по умолчанию
    const items = applyTaxPolicy(rawItems, settings);
    const order = await Order.create({
        org: user.id, number, customerName, items,
        contact: contact || undefined, company: company || undefined, deal: (deal || (await dealForCustomer(user.id, contact, company, customerName))) || undefined, contract: contract || undefined,
        currency: typeof b.currency === "string" && b.currency.trim() ? b.currency.trim().slice(0, 6).toUpperCase() : await defaultCurrency(user.id),
        notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : "",
        template: isTemplate(b.template) ? b.template : "",
        responsible: typeof b.responsible === "string" ? b.responsible.trim().slice(0, 120) : "",
        createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
    });
    const totals = computeTotals(order.items as any);
    await emit(user.id, { type: "order_created", data: { id: String(order._id), number: order.number, customerName: order.customerName, total: String(totals.gross), currency: order.currency } });
    return NextResponse.json(toOrderDTO(order), { status: 201 });
}
