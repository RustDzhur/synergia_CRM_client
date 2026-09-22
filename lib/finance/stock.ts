import Product from "@/models/Product";
import StockMovement from "@/models/StockMovement";

// Меняет остаток товара и пишет запись движения одной операцией; qty может быть отрицательным (расход).
// Услуги (type "service") остатка не имеют — вызывать для них не нужно, но это по-тихому не ошибка (пропускаем).
export async function moveStock(org: string, productId: string, qty: number, reason: "purchase" | "sale" | "writeoff" | "adjustment" | "return", opts: { orderId?: string; note?: string; by?: string } = {}) {
    const product = await Product.findOne({ _id: productId, org });
    if (!product || product.type !== "good" || !qty) return null;
    product.stockQty = (product.stockQty ?? 0) + qty;
    await product.save();
    await StockMovement.create({ org, product: product._id, qty, reason, orderId: opts.orderId, note: opts.note ?? "", by: opts.by ?? "" });
    return product;
}

// Списывает под заказ склад для всех товарных строк (услуги пропускаются); частичная нехватка не блокирует — просто
// уходит в минус, чтобы не рвать процесс (в реальности бывает недостача, это видно на дашборде как отрицательный остаток).
export async function consumeForOrder(org: string, orderId: string, items: { product?: string; qty: number }[], by = "") {
    for (const it of items) {
        if (!it.product) continue;
        await moveStock(org, it.product, -Math.abs(it.qty), "sale", { orderId, by });
    }
}
