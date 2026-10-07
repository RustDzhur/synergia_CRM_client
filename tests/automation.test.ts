import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { runDueJobs } from "@/lib/automation";
import { emit } from "@/lib/automation/emit";

describe.skipIf(!hasDb)("автоматизация", () => {
    it("отложенное действие выполняется ровно один раз при параллельных опросах", async () => {
        const { org } = await makeOrg();
        await prisma.sectionRecord.create({ data: { org, key: "automation:rules", rid: "r1", values: { enabled: "1", event: "invoice_paid", action: "notify", message: "Оплачено", timing: "after_1h", name: "n" } } });
        await prisma.automationJob.create({ data: { org, rule: "r1", event: { type: "invoice_paid", data: { id: "x" } } as never, runAt: new Date(Date.now() - 1000) } });
        const results = await Promise.all(Array.from({ length: 6 }, () => runDueJobs(org, 0)));
        expect(results.reduce((a, b) => a + b, 0)).toBe(1);
        expect(await prisma.notification.count({ where: { org, type: "automation" } })).toBe(1);
    });

    it("новые события запускают правила", async () => {
        const { org } = await makeOrg();
        await prisma.sectionRecord.create({ data: { org, key: "automation:rules", rid: "r2", values: { enabled: "1", event: "task_completed", action: "notify", message: "Готово: {{task.title}}", timing: "immediately", name: "n" } } });
        await emit(org, { type: "task_completed", data: { id: "t1", title: "Отчёт" } });
        const n = await prisma.notification.findMany({ where: { org, type: "automation" } });
        expect(n).toHaveLength(1);
        expect((n[0].params as any).text).toContain("Отчёт");
    });

    it("запись автоматизации в ленту сделки имеет id и дату и не затирается параллельной", async () => {
        const { org } = await makeOrg();
        const stage = await prisma.stage.create({ data: { owner: org, name: "S", order: 0 } });
        const deal = await prisma.deal.create({ data: { owner: org, stage: stage.id, clientName: "D", order: 0, activities: [] } });
        await prisma.sectionRecord.create({ data: { org, key: "automation:rules", rid: "r3", values: { enabled: "1", event: "deal_won", action: "add_note", message: "Победа", timing: "immediately", name: "n" } } });
        await Promise.all(Array.from({ length: 5 }, () => emit(org, { type: "deal_won", data: { id: deal.id, name: "D" } })));
        const feed = (await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).activities as any[];
        expect(feed).toHaveLength(5);
        expect(feed.every((a) => a._id && a.createdAt)).toBe(true);
    });
});
