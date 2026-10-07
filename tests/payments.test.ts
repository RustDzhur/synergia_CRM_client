import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { registerPayment, revertPayment, type PaymentSource } from "@/lib/sync/payments";

const items = [{ description: "Работа", qty: 1, unitPrice: 100, taxRate: 0 }];

async function scene() {
    const { org, userId } = await makeOrg();
    const stage = await prisma.stage.create({ data: { owner: org, name: "S", order: 0 } });
    const contact = await prisma.contact.create({ data: { owner: org, name: "Клиент" } });
    const deal = await prisma.deal.create({ data: { owner: org, stage: stage.id, clientName: "Клиент", order: 0, contact: contact.id, activities: [] } });
    const order = await prisma.order.create({ data: { org, number: `SO-${Math.random()}`, customerName: "Клиент", deal: deal.id, contact: contact.id, status: "invoiced", items: items as never } });
    const invoice = await prisma.invoice.create({ data: { org, number: `RE-${Math.random()}`, customerName: "Клиент", issueDate: "2026-01-01", status: "sent", deal: deal.id, contact: contact.id, order: order.id, items: items as never } });
    return { org, userId, deal, contact, order, invoice };
}

describe.skipIf(!hasDb)("единый учёт оплаты", () => {
    it("повтор того же платежа ничего не меняет (повторный webhook)", async () => {
        const s = await scene();
        const a = await registerPayment(s.org, s.invoice.id, { amount: 40, source: "webhook", externalId: "evt-1", via: "liqpay" });
        const b = await registerPayment(s.org, s.invoice.id, { amount: 40, source: "webhook", externalId: "evt-1", via: "liqpay" });
        expect(a.ok && !a.duplicate).toBe(true);
        expect(b.ok && b.duplicate).toBe(true);
        expect((await prisma.invoice.findUniqueOrThrow({ where: { id: s.invoice.id } })).paidAmount).toBe(40);
        expect(await prisma.paymentEvent.count({ where: { invoice: s.invoice.id } })).toBe(1);
    });

    it("параллельные одинаковые доставки засчитываются один раз", async () => {
        const s = await scene();
        await Promise.all(Array.from({ length: 8 }, () => registerPayment(s.org, s.invoice.id, { amount: 30, source: "webhook", externalId: "same", via: "wayforpay" })));
        expect((await prisma.invoice.findUniqueOrThrow({ where: { id: s.invoice.id } })).paidAmount).toBe(30);
    });

    it("параллельные разные платежи суммируются без потерь", async () => {
        const s = await scene();
        await Promise.all(Array.from({ length: 5 }, (_, i) => registerPayment(s.org, s.invoice.id, { amount: 10, source: "webhook", externalId: `p${i}`, via: "monobank" })));
        const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: s.invoice.id } });
        expect(inv.paidAmount).toBe(50);
        expect(inv.status).toBe("sent");
    });

    it.each<PaymentSource>(["manual", "assistant", "webhook", "bank"])("полная оплата (%s) даёт один и тот же набор следствий", async (source) => {
        const s = await scene();
        const r = await registerPayment(s.org, s.invoice.id, { source, externalId: "x1", via: source, actor: { userId: s.userId, name: "Тест" } });
        expect(r.ok && r.full).toBe(true);
        const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: s.invoice.id } });
        expect(inv.status).toBe("paid");
        expect(inv.paidAt).not.toBeNull();
        // лента сделки и контакта
        for (const doc of [await prisma.deal.findUniqueOrThrow({ where: { id: s.deal.id } }), await prisma.contact.findUniqueOrThrow({ where: { id: s.contact.id } })]) {
            const feed = doc.activities as any[];
            expect(feed.some((a) => a.type === "payment" && a.text.startsWith("@@payment_full"))).toBe(true);
            expect(feed.every((a) => a._id && a.createdAt)).toBe(true);
        }
        // сделка выиграна, заказ оплачен
        expect((await prisma.deal.findUniqueOrThrow({ where: { id: s.deal.id } })).wonAt).not.toBeNull();
        expect((await prisma.order.findUniqueOrThrow({ where: { id: s.order.id } })).status).toBe("paid");
        // журнал и уведомление
        expect(await prisma.auditLog.count({ where: { org: s.org, action: "invoice.paid", entityId: s.invoice.id } })).toBe(1);
        expect(await prisma.notification.count({ where: { org: s.org } })).toBe(1);
    });

    it("«оплачен» без суммы после аванса закрывает остаток, а не прибавляет полную сумму ещё раз", async () => {
        const s = await scene();
        await registerPayment(s.org, s.invoice.id, { amount: 40, source: "manual", externalId: "adv" });
        const r = await registerPayment(s.org, s.invoice.id, { source: "manual", externalId: "rest" });
        expect(r.ok && r.full).toBe(true);
        expect((await prisma.invoice.findUniqueOrThrow({ where: { id: s.invoice.id } })).paidAmount).toBe(100);
    });

    it("сделка не выигрывается, пока есть неоплаченный счёт", async () => {
        const s = await scene();
        await prisma.invoice.create({ data: { org: s.org, number: `RE-${Math.random()}`, customerName: "Клиент", issueDate: "2026-01-02", status: "sent", deal: s.deal.id, items: items as never } });
        await registerPayment(s.org, s.invoice.id, { source: "manual", externalId: "m" });
        expect((await prisma.deal.findUniqueOrThrow({ where: { id: s.deal.id } })).wonAt).toBeNull();
    });

    it("настройка фирмы отключает автовыигрыш", async () => {
        const s = await scene();
        await prisma.financeSettings.upsert({ where: { org: s.org }, create: { org: s.org, autoWinDealOnPaid: false }, update: { autoWinDealOnPaid: false } });
        await registerPayment(s.org, s.invoice.id, { source: "manual", externalId: "m" });
        expect((await prisma.deal.findUniqueOrThrow({ where: { id: s.deal.id } })).wonAt).toBeNull();
    });

    it("черновик банком не закрывается, ручной оплатой — закрывается", async () => {
        const s = await scene();
        await prisma.invoice.update({ where: { id: s.invoice.id }, data: { status: "draft" } });
        expect((await registerPayment(s.org, s.invoice.id, { source: "bank", externalId: "b" })).ok).toBe(false);
        expect((await registerPayment(s.org, s.invoice.id, { source: "manual", externalId: "m" })).ok).toBe(true);
    });

    it("чужая фирма не может провести платёж", async () => {
        const s = await scene();
        const other = await makeOrg();
        expect((await registerPayment(other.org, s.invoice.id, { source: "manual", externalId: "m" })).ok).toBe(false);
        expect((await prisma.invoice.findUniqueOrThrow({ where: { id: s.invoice.id } })).status).toBe("sent");
    });

    it("отмена платежа возвращает сумму, статус и снимает дату оплаты; повтор не вычитает дважды", async () => {
        const s = await scene();
        await registerPayment(s.org, s.invoice.id, { source: "bank", externalId: "tx1" });
        expect((await prisma.invoice.findUniqueOrThrow({ where: { id: s.invoice.id } })).status).toBe("paid");
        await revertPayment(s.org, s.invoice.id, { source: "bank", externalId: "tx1", amount: 100 });
        await revertPayment(s.org, s.invoice.id, { source: "bank", externalId: "tx1", amount: 100 });
        const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: s.invoice.id } });
        expect(inv.status).toBe("sent");
        expect(inv.paidAmount).toBe(0);
        expect(inv.paidAt).toBeNull();
    });
});
