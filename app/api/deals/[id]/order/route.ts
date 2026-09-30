import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { nextNumber } from "@/lib/finance/numbering";
import { cleanItems } from "@/lib/finance/totals";
import { applyTaxPolicy } from "@/lib/finance/tax";
import { defaultCurrency, financeSettings } from "@/lib/finance/settings";
import { reserveForOrder } from "@/lib/finance/stock";
import { toOrderDTO } from "@/lib/finance/dto";
import { MARKETPLACES, type MarketplaceId } from "@/lib/marketplace";
import Deal from "@/models/Deal";
import Expense from "@/models/Expense";
import Order from "@/models/Order";
import Product from "@/models/Product";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/deals/:id/order — собрать заказ из заявки маркетплейса (ТЗ §8, U8).
//
// Раньше заявка площадки жила только в воронке: ни склада, ни счёта, ни доставки. Теперь состав
// заявки (снимок в Deal.market) превращается в настоящий заказ: товарные строки резервируют склад,
// комиссия площадки уходит отдельным расходом к сделке, а дальше работают обычные шаги —
// заказ → счёт одной кнопкой → оплата → доставка → акт.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    try {
        await connectDB();
        const deal = await Deal.findOne({ _id: params.id, owner: user.id });
        if (!deal) return notFound();
        if (!deal.source || !deal.market?.items?.length) {
            return badRequest("У цій сделці немає складу заявки з площадки — замовлення створюється за позиціями маркетплейсу");
        }
        if (deal.market.order) {
            const existing = await Order.findOne({ _id: deal.market.order, org: user.id });
            if (existing) return NextResponse.json({ order: toOrderDTO(existing), existed: true });
        }

        const settings = await financeSettings(user.id);
        // Позиции заявки → строки заказа: ищем товар по имени, чтобы связать строку со складом
        const raw = await Promise.all(
            (deal.market.items as Array<{ name: string; qty: number; price: number }>).map(async (it) => {
                const product = await Product.findOne({ org: user.id, name: it.name }).select("_id");
                return { description: it.name, qty: Number(it.qty) || 1, unitPrice: Number(it.price) || 0, taxRate: undefined as number | undefined, product: product ? String(product._id) : "" };
            })
        );
        const items = cleanItems(applyTaxPolicy(raw, settings));
        const currency = deal.market.currency || (await defaultCurrency(user.id));
        const number = await nextNumber(user.id, "SO");
        const order = await Order.create({
            org: user.id,
            number,
            customerName: deal.clientName,
            contact: deal.contact || undefined,
            company: deal.company || undefined,
            deal: deal._id,
            items,
            currency,
        });

        // Резерв склада: товар обещан заказу, но ещё лежит на складе (снимается при выдаче)
        await reserveForOrder(user.id, String(order._id), items as unknown as { product?: string; qty: number }[]);

        // Комиссия площадки — расход по сделке, иначе маржа сделки выглядела бы больше, чем есть
        const commission = Number(deal.market.commission) || 0;
        if (commission > 0 && Number(deal.market.amount) > 0) {
            const label = MARKETPLACES[deal.source as MarketplaceId]?.label ?? deal.source;
            await Expense.create({
                org: user.id,
                vendor: label,
                category: "marketplace",
                amount: Math.round(Number(deal.market.amount) * commission) / 100,
                currency,
                date: new Date().toISOString().slice(0, 10),
                deal: deal._id,
                order: order._id,
                notes: `Комісія ${label} ${commission} % за замовлення ${deal.externalId || ""}`.trim(),
            }).catch(() => undefined);
        }

        deal.market.order = order._id;
        deal.markModified("market");
        await deal.save();
        await emit(user.id, { type: "order_created", data: { id: String(order._id), number: order.number, customerName: order.customerName, source: deal.source } });
        return NextResponse.json({ order: toOrderDTO(order) }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
