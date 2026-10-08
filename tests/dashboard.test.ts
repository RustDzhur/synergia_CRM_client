import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser } from "./helpers/http";
import { GET } from "@/app/api/finance/dashboard/route";

const items = (n: number) => [{ description: "Работа", qty: 1, unitPrice: n, taxRate: 0 }];

describe.skipIf(!hasDb)("финансовый дашборд", () => {
    it("доход за период, долг по остатку, валюты не смешиваются", async () => {
        const { org, userId } = await makeOrg();
        await prisma.financeSettings.upsert({ where: { org }, create: { org, currency: "EUR" }, update: { currency: "EUR" } });
        const now = new Date();
        const old = new Date(now.getFullYear() - 3, 0, 15);
        const day = now.toISOString().slice(0, 10);
        await prisma.invoice.create({ data: { org, number: "P-NEW", customerName: "К", issueDate: day, status: "paid", paidAt: now, paidAmount: 100, items: items(100) as never } });
        await prisma.invoice.create({ data: { org, number: "P-OLD", customerName: "К", issueDate: "2020-01-15", status: "paid", paidAt: old, paidAmount: 500, items: items(500) as never } });
        await prisma.invoice.create({ data: { org, number: "S-1", customerName: "К", issueDate: day, status: "sent", paidAmount: 30, items: items(100) as never } });
        await prisma.invoice.create({ data: { org, number: "USD-1", customerName: "К", issueDate: day, status: "paid", paidAt: now, currency: "USD", items: items(999) as never } });
        await prisma.expense.create({ data: { org, vendor: "V", amount: 40, date: day, currency: "EUR" } });
        const res = await (await GET(asUser(userId)("/api/finance/dashboard?months=6"))).json();
        expect(res.currency).toBe("EUR");
        expect(res.revenue).toBe(100); // старая оплата и доллары не входят
        expect(res.outstandingAmount).toBe(70); // 100 минус уже полученные 30
        expect(res.expenses).toBe(40);
        expect(res.profit).toBe(60);
        expect(res.otherCurrency).toBe(1);
    });
});
