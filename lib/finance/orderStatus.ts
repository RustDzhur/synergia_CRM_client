import { prisma } from "@/lib/prisma";
import { emit } from "@/lib/automation/emit";
import { consumeForOrder, moveStock, releaseForOrder, type Db } from "@/lib/finance/stock";
import { logActivity } from "@/lib/sync/feed";
import { recordSyncError } from "@/lib/sync/errors";
import { fx } from "@/lib/sync/texts";

// Статусы заказа и допустимые переходы между ними. Раньше любой статус можно было поставить поверх любого:
// заказ «выдан» возвращался в «черновик», склад не пополнялся, а отмена после выдачи не возвращала товар.
export const ORDER_STATUSES = ["draft", "confirmed", "fulfilled", "invoiced", "paid", "closed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    draft: ["confirmed", "invoiced", "paid", "cancelled"],
    confirmed: ["draft", "fulfilled", "invoiced", "paid", "cancelled"],
    fulfilled: ["invoiced", "paid", "closed", "cancelled"],
    invoiced: ["fulfilled", "paid", "closed", "cancelled"],
    paid: ["fulfilled", "closed"],
    closed: [],
    cancelled: [],
};

export class OrderStatusError extends Error {}

// Сколько товара по заказу уже списано со склада — по журналу движений (sale минус возвраты). Журнал — единственный
// источник правды: повторная выдача не спишет второй раз, отмена вернёт ровно столько, сколько ушло.
async function consumedByProduct(db: Db, org: string, orderId: string): Promise<Map<string, number>> {
    const rows = await db.stockMovement.groupBy({ by: ["product"], where: { org, orderId, reason: { in: ["sale", "return"] } }, _sum: { qty: true } });
    return new Map(rows.map((r) => [String(r.product), -(r._sum.qty ?? 0)]));
}

// Снять резерв заказа ровно на то количество, что было зарезервировано (по журналу движений): повторный вызов
// или заказ без резерва ничего не делают — склад не «пополняется» из воздуха.
export async function releaseReserve(db: Db, org: string, orderId: string) {
    const reserved = await db.stockMovement.groupBy({ by: ["product"], where: { org, orderId, reason: { in: ["reserve", "reserve_release"] } }, _sum: { qty: true } });
    for (const row of reserved.filter((r) => (r._sum.qty ?? 0) < 0)) {
        await releaseForOrder(org, orderId, [{ product: row.product, qty: Math.abs(row._sum.qty ?? 0) }], "", db);
    }
}

export async function setOrderStatus(org: string, orderId: string, to: string, actor: { userId?: string; name?: string } = {}) {
    if (!(ORDER_STATUSES as readonly string[]).includes(to)) throw new OrderStatusError("Unknown order status");
    const target = to as OrderStatus;
    const before = await prisma.order.findFirst({ where: { id: orderId, org } });
    if (!before) throw new OrderStatusError("Order not found");
    if (before.status === target) return { order: before, changed: false };
    const allowed = ORDER_TRANSITIONS[before.status as OrderStatus] ?? [];
    if (!allowed.includes(target)) throw new OrderStatusError(`An order cannot move from “${before.status}” to “${target}”`);

    // статус и движения склада — одним действием: сбой посередине откатывает всё
    const order = await prisma.$transaction(async (tx) => {
        const items = ((before.items as any[]) ?? []) as { product?: string; qty: number }[];
        if (target === "fulfilled") {
            // резерв, если был, снимается перед списанием, иначе склад ушёл бы в минус дважды; уже списанное не списываем снова
            await releaseReserve(tx, org, orderId);
            const done = await consumedByProduct(tx, org, orderId);
            const need = new Map<string, number>();
            for (const it of items) if (it.product) need.set(it.product, (need.get(it.product) ?? 0) + Math.abs(Number(it.qty) || 0));
            const rest = Array.from(need, ([product, qty]) => ({ product, qty: qty - (done.get(product) ?? 0) })).filter((l) => l.qty > 0);
            await consumeForOrder(org, orderId, rest, actor.name ?? "", tx);
        }
        if (target === "cancelled") {
            await releaseReserve(tx, org, orderId);
            // отмена после выдачи возвращает товар на склад
            for (const [product, qty] of Array.from((await consumedByProduct(tx, org, orderId)).entries())) {
                if (qty > 0) await moveStock(org, product, qty, "return", { orderId, by: actor.name ?? "", note: `Скасування ${before.number}`, tx });
            }
        }
        // обратный переход «выдан → не выдан» (invoiced/paid/closed после fulfilled остаются выданными — ничего не возвращаем)
        return tx.order.update({ where: { id: orderId }, data: { status: target } });
    });

    await emit(org, { type: "order_status", data: { id: order.id, number: order.number, status: order.status, customerName: order.customerName } });
    try {
        await logActivity(org, { deal: order.deal, contact: order.contact, company: order.company }, { type: "order", text: fx(`order_status_${order.status}`, { number: order.number }), meta: `order:${order.id}`, key: `order-status:${order.id}:${order.status}:${Date.now()}` });
    } catch (e) {
        await recordSyncError(org, "order.feed", e, { id: order.id });
    }
    return { order, changed: true };
}
