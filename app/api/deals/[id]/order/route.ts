import { NextResponse } from "next/server";
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
import { prisma } from "@/lib/prisma";
import { dealScope } from "@/lib/sync/people";
import { recordSyncError } from "@/lib/sync/errors";

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
        const deal = await prisma.deal.findFirst({ where: { id: params.id, owner: user.id, ...dealScope(user) } });
        if (!deal) return notFound();
        const market = (deal.market ?? {}) as any;
        if (!deal.source || !market.items?.length) {
            return badRequest("У цій сделці немає складу заявки з площадки — замовлення створюється за позиціями маркетплейсу");
        }
        if (market.order) {
            const existing = await prisma.order.findFirst({ where: { id: String(market.order), org: user.id } });
            if (existing) return NextResponse.json({ order: toOrderDTO(existing), existed: true });
        }

        const settings = await financeSettings(user.id);
        // Позиции заявки → строки заказа: ищем товар по имени, чтобы связать строку со складом
        const raw = await Promise.all(
            (market.items as Array<{ name: string; qty: number; price: number }>).map(async (it) => {
                const product = await prisma.product.findFirst({ where: { org: user.id, name: it.name }, select: { id: true } });
                return { description: it.name, qty: Number(it.qty) || 1, unitPrice: Number(it.price) || 0, taxRate: undefined as number | undefined, product: product ? product.id : "" };
            })
        );
        const items = cleanItems(applyTaxPolicy(raw, settings));
        const currency = market.currency || (await defaultCurrency(user.id));
        const number = await nextNumber(user.id, "SO");
        const order = await prisma.order.create({
            data: {
                org: user.id,
                number,
                customerName: deal.clientName,
                contact: deal.contact || undefined,
                company: deal.company || undefined,
                deal: deal.id,
                items: items as any,
                currency,
            },
        });

        // Резерв склада: товар обещан заказу, но ещё лежит на складе (снимается при выдаче)
        await reserveForOrder(user.id, order.id, items as unknown as { product?: string; qty: number }[]);

        // Комиссия площадки — расход по сделке, иначе маржа сделки выглядела бы больше, чем есть
        const commission = Number(market.commission) || 0;
        if (commission > 0 && Number(market.amount) > 0) {
            const label = MARKETPLACES[deal.source as MarketplaceId]?.label ?? deal.source;
            await prisma.expense.create({
                data: {
                    org: user.id,
                    vendor: label,
                    category: "marketplace",
                    amount: Math.round(Number(market.amount) * commission) / 100,
                    currency,
                    date: new Date().toISOString().slice(0, 10),
                    deal: deal.id,
                    order: order.id,
                    notes: `Комісія ${label} ${commission} % за замовлення ${deal.externalId || ""}`.trim(),
                },
            }).catch((e) => recordSyncError(user.id, "marketplace.commission", e, { id: deal.id }));
        }

        await prisma.deal.update({ where: { id: deal.id }, data: { market: { ...market, order: order.id } as any } });
        await emit(user.id, { type: "order_created", data: { id: order.id, number: order.number, customerName: order.customerName, source: deal.source } });
        return NextResponse.json({ order: toOrderDTO(order) }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
