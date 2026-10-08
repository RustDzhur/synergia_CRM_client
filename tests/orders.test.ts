import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { setOrderStatus, OrderStatusError } from "@/lib/finance/orderStatus";
import { moveStock } from "@/lib/finance/stock";

async function scene(qtyOnStock = 10) {
    const { org } = await makeOrg();
    const product = await prisma.product.create({ data: { org, name: "Товар", type: "good", stockQty: qtyOnStock } as never });
    const items = [{ description: "Товар", qty: 3, unitPrice: 10, taxRate: 0, product: product.id }];
    const order = await prisma.order.create({ data: { org, number: `SO-${Math.random()}`, customerName: "К", status: "confirmed", items: items as never } });
    return { org, product, order };
}
const stock = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).stockQty;

describe.skipIf(!hasDb)("заказ и склад", () => {
    it("выдача списывает товар один раз, даже при повторной выдаче через оплату", async () => {
        const s = await scene();
        await setOrderStatus(s.org, s.order.id, "fulfilled");
        expect(await stock(s.product.id)).toBe(7);
        await setOrderStatus(s.org, s.order.id, "invoiced");
        await setOrderStatus(s.org, s.order.id, "fulfilled"); // invoiced -> fulfilled допустим, но списано уже всё
        expect(await stock(s.product.id)).toBe(7);
    });

    it("отмена после выдачи возвращает товар", async () => {
        const s = await scene();
        await setOrderStatus(s.org, s.order.id, "fulfilled");
        await setOrderStatus(s.org, s.order.id, "cancelled");
        expect(await stock(s.product.id)).toBe(10);
    });

    it("запрещённый переход отклоняется и не двигает склад", async () => {
        const s = await scene();
        await setOrderStatus(s.org, s.order.id, "fulfilled");
        await expect(setOrderStatus(s.org, s.order.id, "draft")).rejects.toBeInstanceOf(OrderStatusError);
        await setOrderStatus(s.org, s.order.id, "closed");
        await expect(setOrderStatus(s.org, s.order.id, "fulfilled")).rejects.toBeInstanceOf(OrderStatusError);
        expect(await stock(s.product.id)).toBe(7);
    });

    it("параллельные движения склада не теряются", async () => {
        const s = await scene(0);
        await Promise.all(Array.from({ length: 30 }, () => moveStock(s.org, s.product.id, 1, "purchase")));
        expect(await stock(s.product.id)).toBe(30);
        expect(await prisma.stockMovement.count({ where: { org: s.org, product: s.product.id } })).toBe(30);
    });

    it("чужой заказ не меняется", async () => {
        const s = await scene();
        const other = await makeOrg();
        await expect(setOrderStatus(other.org, s.order.id, "fulfilled")).rejects.toBeInstanceOf(OrderStatusError);
    });
});
