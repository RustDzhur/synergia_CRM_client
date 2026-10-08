import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser, ctx } from "./helpers/http";
import { GET as office } from "@/app/api/office/route";
import { PATCH as patchRobot, DELETE as fireRobot } from "@/app/api/office/robots/[id]/route";
import { POST as giveTask } from "@/app/api/office/tasks/route";
import { POST as taskAction } from "@/app/api/office/tasks/[id]/route";
import { getRobot, listRobots, createTask } from "@/lib/office/store";

// Платформенные роботы (Rex, Sven, Ada) живут в фирме администратора платформы. Их не должен видеть и трогать никто, кроме самого администратора:
// ни другая фирма, ни рядовой сотрудник той же фирмы.
async function scene() {
    const a = await makeOrg();
    await prisma.user.update({ where: { id: a.userId }, data: { platformAdmin: true } });
    const colleague = await prisma.user.create({ data: { email: `c${Date.now()}${Math.random()}@t.local`, firstname: "Коллега", lastname: "Т", passwordHash: "x" } });
    await prisma.membership.create({ data: { org: a.org, user: colleague.id, role: "manager", modules: ["automation"] } });
    const b = await makeOrg();
    const adminReq = asUser(a.userId);
    const res = await office(adminReq("/api/office"));
    const body = await res.json();
    const platform = body.robots.filter((r: { template: string }) => r.template.startsWith("p_"));
    return { a, b, colleague, adminReq, platform, colleagueReq: asUser(colleague.id, a.org), otherReq: asUser(b.userId) };
}

describe.skipIf(!hasDb)("изоляция роботов платформы", () => {
    it("администратор видит роботов платформы, остальные — нет", async () => {
        const s = await scene();
        expect(s.platform.length).toBe(3);
        for (const req of [s.colleagueReq, s.otherReq]) {
            const body = await (await office(req("/api/office"))).json();
            expect(body.robots.some((r: { template: string }) => r.template.startsWith("p_"))).toBe(false);
            expect(body.platform).toBeUndefined();
        }
    });

    it("рядовой сотрудник той же фирмы и чужая фирма не правят, не увольняют и не дают поручений роботу платформы", async () => {
        const s = await scene();
        const target = s.platform.find((r: { template: string }) => r.template === "p_blog");
        for (const req of [s.colleagueReq, s.otherReq]) {
            expect((await patchRobot(req(`/api/office/robots/${target.id}`, "PATCH", { name: "Взлом" }), ctx(target.id))).status).toBe(400);
            expect((await fireRobot(req(`/api/office/robots/${target.id}`, "DELETE"), ctx(target.id))).status).toBe(400);
            const t = await giveTask(req("/api/office/tasks", "POST", { robot: target.id, text: "опубликуй статью" }));
            expect([400, 503]).toContain(t.status);
        }
        expect(await getRobot(s.a.org, target.id)).toBeNull(); // без доступа к платформе робота «нет»
        expect((await getRobot(s.a.org, target.id, { platform: true }))?.name).toBe(target.name);
        expect((await listRobots(s.a.org)).some((r) => r.template.startsWith("p_"))).toBe(false);
    });

    it("поручение роботу платформы не видно и не управляется рядовым сотрудником", async () => {
        const s = await scene();
        const target = s.platform.find((r: { template: string }) => r.template === "p_blog");
        const task = await createTask(s.a.org, { robot: target.id, robotName: target.name, text: "статья", source: "user" });
        const body = await (await office(s.colleagueReq("/api/office"))).json();
        expect(body.tasks.some((t: { id: string }) => t.id === task.id)).toBe(false);
        const res = await taskAction(s.colleagueReq(`/api/office/tasks/${task.id}`, "POST", { action: "cancel" }), ctx(task.id));
        expect(res.status).toBe(404);
        const adminBody = await (await office(s.adminReq("/api/office"))).json();
        expect(adminBody.tasks.some((t: { id: string }) => t.id === task.id)).toBe(true);
    });
});
