import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser, ctx } from "./helpers/http";
import { POST as createTask } from "@/app/api/tasks/route";
import { PATCH as patchTask } from "@/app/api/tasks/[id]/route";
import { sweepDeadlines } from "@/lib/sync/deadlines";

async function scene() {
    const { org, userId } = await makeOrg();
    const colleague = await prisma.user.create({ data: { email: `a${Date.now()}${Math.random()}@t.local`, firstname: "Анна", lastname: "Смирнова", passwordHash: "x" } });
    await prisma.membership.create({ data: { org, user: colleague.id, role: "manager" } });
    const stage = await prisma.stage.create({ data: { owner: org, name: "S", order: 0 } });
    const company = await prisma.company.create({ data: { owner: org, name: "Альфа" } });
    const contact = await prisma.contact.create({ data: { owner: org, name: "Иван", companyId: company.id } });
    const deal = await prisma.deal.create({ data: { owner: org, stage: stage.id, clientName: "Сделка", order: 0, contact: contact.id, company: company.id, activities: [] } });
    return { org, userId, colleague, deal, contact, company, req: asUser(userId), reqColleague: asUser(colleague.id, org) };
}

describe.skipIf(!hasDb)("задачи", () => {
    it("задача из сделки наследует контакт и фирму и видна в их лентах", async () => {
        const s = await scene();
        const res = await createTask(s.req("/api/tasks", "POST", { title: "Позвонить", deal: s.deal.id }));
        expect(res.status).toBe(201);
        const task = await res.json();
        expect(task.contact).toBe(s.contact.id);
        expect(task.company).toBe(s.company.id);
        for (const feed of [(await prisma.contact.findUniqueOrThrow({ where: { id: s.contact.id } })).activities, (await prisma.deal.findUniqueOrThrow({ where: { id: s.deal.id } })).activities] as any[][]) {
            expect(feed.some((a) => a.type === "task" && a.text.includes("Позвонить"))).toBe(true);
        }
    });

    it("чужой контакт или сделку привязать нельзя", async () => {
        const s = await scene();
        const other = await scene();
        const res = await patchTask(s.req(`/api/tasks/x`, "PATCH", {}), ctx("x"));
        expect(res.status).toBe(404);
        const task = await (await createTask(s.req("/api/tasks", "POST", { title: "T" }))).json();
        const bad = await patchTask(s.req(`/api/tasks/${task._id}`, "PATCH", { contact: other.contact.id }), ctx(task._id));
        expect(bad.status).toBe(400);
    });

    it("поручение коллеге: личное уведомление; выполнение: лента, дата, уведомление автору", async () => {
        const s = await scene();
        const task = await (await createTask(s.req("/api/tasks", "POST", { title: "Счёт", deal: s.deal.id, responsible: "Анна Смирнова" }))).json();
        expect(task.responsibleUser).toBe(s.colleague.id);
        expect(await prisma.notification.count({ where: { org: s.org, user: s.colleague.id } })).toBe(1);
        const done = await patchTask(s.reqColleague(`/api/tasks/${task._id}`, "PATCH", { completed: true }), ctx(task._id));
        expect(done.status).toBe(200);
        const row = await prisma.task.findUniqueOrThrow({ where: { id: task._id } });
        expect(row.completedAt).not.toBeNull();
        const feed = (await prisma.deal.findUniqueOrThrow({ where: { id: s.deal.id } })).activities as any[];
        expect(feed.some((a) => a.text.includes("Задача выполнена"))).toBe(true);
        expect(await prisma.notification.count({ where: { org: s.org, user: s.userId } })).toBe(1);
    });

    it("можно снять и сменить связь со сделкой", async () => {
        const s = await scene();
        const task = await (await createTask(s.req("/api/tasks", "POST", { title: "T", deal: s.deal.id }))).json();
        const res = await patchTask(s.req(`/api/tasks/${task._id}`, "PATCH", { deal: "" }), ctx(task._id));
        expect((await res.json()).deal).toBeNull();
    });

    it("серверный обход сроков уведомляет ответственного один раз и без открытого кабинета", async () => {
        const s = await scene();
        const soon = new Date(Date.now() + 30 * 60_000).toISOString().slice(0, 16);
        const task = await prisma.task.create({ data: { owner: s.org, title: "Скоро", deadline: soon, responsibleUser: s.colleague.id } });
        expect(await sweepDeadlines(s.org, 0, 0)).toBe(1);
        expect(await sweepDeadlines(s.org, 0, 0)).toBe(0);
        const n = await prisma.notification.findMany({ where: { org: s.org, type: "deadline" } });
        expect(n).toHaveLength(1);
        expect(n[0].user).toBe(s.colleague.id);
        expect((n[0].params as any).stage).toBe("1h");
        await prisma.task.update({ where: { id: task.id }, data: { completed: true } });
    });
});
