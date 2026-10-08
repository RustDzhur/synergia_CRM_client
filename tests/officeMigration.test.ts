import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { createTask, listRobots, listTasks, createRobot } from "@/lib/office/store";

describe.skipIf(!hasDb)("Робот-офис в таблицах", () => {
    it("создание и чтение идут через Robot/RobotTask; миграция из SectionRecord идемпотентна и ничего не теряет", async () => {
        const o = await makeOrg();
        const r = await createRobot(o.org, { name: "Bob", skills: ["crm"], instructions: "x" });
        await createTask(o.org, { robot: r.id, robotName: "Bob", text: "do", source: "user" });
        expect(await prisma.robot.count({ where: { org: o.org } })).toBe(1);
        expect((await listTasks(o.org))[0].status).toBe("queued");
        expect((await listRobots(o.org))[0].name).toBe("Bob");
        // старые записи разделов переезжают один раз
        await prisma.sectionRecord.create({ data: { org: o.org, key: "office:robot", rid: "rOLD", values: { name: "Old", skills: ["crm"], instructions: "y", enabled: false } as never } });
        await prisma.sectionRecord.create({ data: { org: o.org, key: "office:task", rid: "tOLD", values: { robot: "rOLD", robotName: "Old", text: "t", status: "done", createdAt: "2026-01-01" } as never } });
        const run = () => execFileSync("node", ["scripts/migrate-office.mjs"], { env: process.env, encoding: "utf8" });
        run(); run();
        expect(await prisma.robot.count({ where: { org: o.org } })).toBe(2);
        expect(await prisma.robotTask.count({ where: { org: o.org } })).toBe(2);
        const old = await prisma.robot.findFirst({ where: { org: o.org, rid: "rOLD" } });
        expect(old?.enabled).toBe(false);
    });
});
