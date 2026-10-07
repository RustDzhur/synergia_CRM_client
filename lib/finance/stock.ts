import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Клиент базы: обычный или внутри транзакции (prisma.$transaction). Операции склада, которые идут одним действием
// (смена статуса заказа + движения), передают сюда транзакцию, чтобы сбой посередине не оставил склад и журнал рассогласованными.
export type Db = typeof prisma | Prisma.TransactionClient;

// Меняет остаток товара и пишет запись движения одной операцией; qty может быть отрицательным (расход).
// Услуги (type "service") остатка не имеют — вызывать для них не нужно, но это по-тихому не ошибка (пропускаем).
export async function moveStock(
    org: string,
    productId: string,
    qty: number,
    reason: "purchase" | "sale" | "writeoff" | "adjustment" | "return" | "reserve" | "reserve_release" | "transfer_out" | "transfer_in" | "surplus",
    opts: { orderId?: string; note?: string; by?: string; warehouse?: unknown; unitCost?: number; docId?: unknown; tx?: Db } = {}
) {
    const db = opts.tx ?? prisma;
    const product = await db.product.findFirst({ where: { id: productId, org } });
    if (!product || product.type !== "good" || !qty) return null;
    // Остаток меняется на месте (increment), а не «прочитали, прибавили, записали»: два движения одновременно
    // раньше затирали друг друга, и остаток расходился с журналом.
    await db.product.update({ where: { id: productId }, data: { stockQty: { increment: qty } } });
    const movement = await db.stockMovement.create({
        data: {
            org,
            product: product.id,
            qty,
            reason,
            orderId: opts.orderId ?? null,
            warehouse: opts.warehouse != null ? String(opts.warehouse) : null,
            unitCost: Number(opts.unitCost) || 0,
            doc: opts.docId != null ? String(opts.docId) : null,
            note: opts.note ?? "",
            by: opts.by ?? "",
        },
    });
    // Возвращаем и движение: вызывающему оно нужно для отката (импорт) или для аудита
    return { product, movement };
}

// Списывает под заказ склад для всех товарных строк (услуги пропускаются); частичная нехватка не блокирует — просто
// уходит в минус, чтобы не рвать процесс (в реальности бывает недостача, это видно на дашборде как отрицательный остаток).
export async function consumeForOrder(org: string, orderId: string, items: { product?: string; qty: number }[], by = "", tx?: Db) {
    for (const it of items) {
        if (!it.product) continue;
        await moveStock(org, it.product, -Math.abs(it.qty), "sale", { orderId, by, tx });
    }
}

// Резерв под заказ (Украина): товар ещё лежит на складе, но обещан этому заказу — остаток в наличии
// уменьшается, а движение помечается причиной reserve. При выдаче заказа резерв снимается
// (reserve_release), и уже за ним идёт настоящее списание (sale) — иначе склад списался бы дважды.
export async function reserveForOrder(org: string, orderId: string, items: { product?: string; qty: number }[], by = "", tx?: Db) {
    for (const it of items) {
        if (!it.product) continue;
        await moveStock(org, it.product, -Math.abs(it.qty), "reserve", { orderId, by, tx });
    }
}

export async function releaseForOrder(org: string, orderId: string, items: { product?: string; qty: number }[], by = "", tx?: Db) {
    for (const it of items) {
        if (!it.product) continue;
        await moveStock(org, it.product, Math.abs(it.qty), "reserve_release", { orderId, by, tx });
    }
}
