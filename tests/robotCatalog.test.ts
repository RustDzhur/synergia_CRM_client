import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser, ctx } from "./helpers/http";
import { GET as office } from "@/app/api/office/route";
import { POST as hire } from "@/app/api/office/robots/route";
import { GET as adminList, POST as adminCreate } from "@/app/api/admin/robot-templates/route";
import { PATCH as adminPatch, DELETE as adminDelete } from "@/app/api/admin/robot-templates/[id]/route";
import { resetCatalogCache, loadCatalog } from "@/lib/office/catalog";

async function admin() {
    const a = await makeOrg();
    await prisma.user.update({ where: { id: a.userId }, data: { platformAdmin: true } });
    return { ...a, req: asUser(a.userId) };
}

describe.skipIf(!hasDb)("каталог ролей роботов в базе", () => {
    it("сид подгружает встроенные роли, обычная фирма видит их в каталоге найма без платформенных", async () => {
        resetCatalogCache();
        const a = await admin();
        const o = await makeOrg();
        const body = await (await office(asUser(o.userId)("/api/office"))).json();
        const ids = body.catalog.map((c: { id: string }) => c.id);
        expect(ids).toContain("sales");
        expect(ids.some((i: string) => i.startsWith("p_"))).toBe(false);
        expect((await (await adminList(a.req("/api/admin/robot-templates"))).json()).templates.length).toBeGreaterThanOrEqual(16);
    });

    it("каталог правит только администратор платформы", async () => {
        const o = await makeOrg();
        const req = asUser(o.userId);
        expect((await adminList(req("/api/admin/robot-templates"))).status).toBe(403);
        expect((await adminCreate(req("/api/admin/robot-templates", "POST", { id: "x1" }))).status).toBe(403);
        expect((await adminPatch(req("/api/admin/robot-templates/sales", "PATCH", { name: "X" }), ctx("sales"))).status).toBe(403);
        expect((await adminDelete(req("/api/admin/robot-templates/sales", "DELETE"), ctx("sales"))).status).toBe(403);
    });

    it("новая роль для UZ появляется в каталоге только у фирм этого рынка; отключённая — ни у кого", async () => {
        const a = await admin();
        const id = `uzbuh${Math.random().toString(36).slice(2, 8)}`;
        const created = await adminCreate(a.req("/api/admin/robot-templates", "POST", { id, name: "Dilnoza", zone: "finance", accent: "teal", skills: ["invoices", "finance"], duties: "Accounting for Uzbekistan.", markets: ["UA"], texts: { uz: { title: "Hisobchi", desc: "ЭСФ" }, en: { title: "UA accountant" } } }));
        expect(created.status).toBe(201);
        const ua = await makeOrg();
        const de = await makeOrg();
        await prisma.financeSettings.upsert({ where: { org: ua.org }, create: { org: ua.org, country: "UA" } as never, update: { country: "UA" } });
        await prisma.financeSettings.upsert({ where: { org: de.org }, create: { org: de.org, country: "DE" } as never, update: { country: "DE" } });
        const seen = async (o: { userId: string }) => (await (await office(asUser(o.userId)("/api/office"))).json()).catalog.map((c: { id: string }) => c.id);
        expect(await seen(ua)).toContain(id);
        expect(await seen(de)).not.toContain(id);
        // найм из каталога для чужого рынка отклоняется на сервере, а не только скрыт в интерфейсе
        expect((await hire(asUser(de.userId)("/api/office/robots", "POST", { template: id }))).status).toBe(400);
        const ok = await hire(asUser(ua.userId)("/api/office/robots", "POST", { template: id }));
        expect(ok.status).toBe(201);
        expect((await ok.json()).title).toBe("UA accountant");
        await adminPatch(a.req(`/api/admin/robot-templates/${id}`, "PATCH", { active: false }), ctx(id));
        expect(await seen(ua)).not.toContain(id);
        expect((await adminDelete(a.req(`/api/admin/robot-templates/${id}`, "DELETE"), ctx(id))).status).toBe(200);
        expect((await loadCatalog()).some((t) => t.id === id)).toBe(false);
    });

    it("проверка ввода: неизвестные навык, зона, рынок и пустые обязанности отклоняются", async () => {
        const a = await admin();
        const base = { id: "bad1", name: "N", zone: "office", accent: "lime", skills: ["crm"], duties: "d" };
        for (const patch of [{ skills: ["nope"] }, { zone: "moon" }, { markets: ["XX"] }, { duties: "" }, { id: "Bad Id" }]) {
            expect((await adminCreate(a.req("/api/admin/robot-templates", "POST", { ...base, ...patch }))).status).toBe(400);
        }
    });

    it("встроенную роль нельзя удалить насовсем: она отключается", async () => {
        const a = await admin();
        const r = await adminDelete(a.req("/api/admin/robot-templates/support", "DELETE"), ctx("support"));
        expect((await r.json()).result).toBe("disabled");
        await adminPatch(a.req("/api/admin/robot-templates/support", "PATCH", { active: true }), ctx("support"));
        expect((await loadCatalog()).find((t) => t.id === "support")?.active).toBe(true);
    });
});

describe.skipIf(!hasDb)("роли рынка UZ", () => {
    it("узбекские роли предлагаются только фирмам UZ, наймом подписываются из записи каталога", async () => {
        resetCatalogCache();
        const uz = await makeOrg();
        const ua = await makeOrg();
        await prisma.financeSettings.create({ data: { org: uz.org, country: "UZ" } });
        await prisma.financeSettings.create({ data: { org: ua.org, country: "UA" } });
        const ids = async (o: { userId: string }) => (await (await office(asUser(o.userId)("/api/office"))).json()).catalog.map((c: { id: string }) => c.id);
        expect(await ids(uz)).toEqual(expect.arrayContaining(["uz_esf", "uz_warehouse", "uz_payments", "uz_support", "sales"]));
        expect(await ids(ua)).not.toContain("uz_esf");
        expect((await hire(asUser(ua.userId)("/api/office/robots", "POST", { template: "uz_esf" }))).status).toBe(400);
        const r = await hire(asUser(uz.userId)("/api/office/robots", "POST", { template: "uz_esf" }));
        expect(r.status).toBe(201);
        expect((await r.json()).title).toBe("ESF accountant");
    });
});
