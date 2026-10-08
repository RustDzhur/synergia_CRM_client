import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { nextNumber } from "@/lib/finance/numbering";

describe.skipIf(!hasDb)("нумерация документов", () => {
    it("40 одновременных запросов дают 40 разных последовательных номеров", async () => {
        const { org } = await makeOrg();
        const numbers = await Promise.all(Array.from({ length: 40 }, () => nextNumber(org, "RE")));
        expect(new Set(numbers).size).toBe(40);
        const seqs = numbers.map((n) => Number(n.split("-").pop())).sort((a, b) => a - b);
        expect(seqs).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    });

    it("префиксы считаются отдельно, а год входит в номер", async () => {
        const { org } = await makeOrg();
        const year = new Date().getFullYear();
        expect(await nextNumber(org, "RE")).toBe(`RE-${year}-1`);
        expect(await nextNumber(org, "AN")).toBe(`AN-${year}-1`);
        expect(await nextNumber(org, "RE")).toBe(`RE-${year}-2`);
    });

    it("занятые номера пропускаются: отставший счётчик не даёт ошибку", async () => {
        const { org } = await makeOrg();
        const year = new Date().getFullYear();
        for (const n of [1, 2, 3]) await prisma.invoice.create({ data: { org, number: `RE-${year}-${n}`, customerName: "X", issueDate: "2026-01-01" } });
        await prisma.order.create({ data: { org, number: `RE-${year}-4`, customerName: "X" } });
        expect(await nextNumber(org, "RE")).toBe(`RE-${year}-5`);
    });

    it("в базе нельзя завести два счёта фирмы с одним номером", async () => {
        const { org } = await makeOrg();
        const mk = () => prisma.invoice.create({ data: { org, number: "RE-1", customerName: "X", issueDate: "2026-01-01" } });
        await mk();
        await expect(mk()).rejects.toThrow();
    });
});
