import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser } from "./helpers/http";
import { requireUser } from "@/lib/auth";

async function member(org: string, role: "manager" | "employee" | "viewer") {
    const u = await prisma.user.create({ data: { email: `m${Date.now()}${Math.random()}@t.local`, firstname: role, lastname: "x", passwordHash: "x" } });
    await prisma.membership.create({ data: { org, user: u.id, role } });
    return asUser(u.id, org);
}

describe.skipIf(!hasDb)("права на реальных запросах (requireUser)", () => {
    it("сотрудник и наблюдатель не получают банк, склад, закупки и выгрузку счетов", async () => {
        const { org } = await makeOrg();
        const employee = await member(org, "employee");
        const viewer = await member(org, "viewer");
        for (const path of ["/api/bank/accounts", "/api/bank/transactions", "/api/stock", "/api/suppliers", "/api/purchases", "/api/export?kind=invoices", "/api/warehouses", "/api/production"]) {
            expect(await requireUser(employee(path)), `employee ${path}`).toBeNull();
            expect(await requireUser(viewer(path)), `viewer ${path}`).toBeNull();
        }
    });

    it("сотрудник работает с CRM, задачами и выгрузкой контактов", async () => {
        const { org } = await makeOrg();
        const employee = await member(org, "employee");
        for (const path of ["/api/contacts", "/api/deals", "/api/tasks", "/api/export?kind=contacts", "/api/lookup"]) {
            expect(await requireUser(employee(path)), path).not.toBeNull();
        }
    });

    it("менеджер видит финансы, наблюдатель только читает", async () => {
        const { org } = await makeOrg();
        const manager = await member(org, "manager");
        const viewer = await member(org, "viewer");
        expect(await requireUser(manager("/api/bank/accounts"))).not.toBeNull();
        expect(await requireUser(viewer("/api/contacts"))).not.toBeNull();
        expect(await requireUser(viewer("/api/contacts", "POST", {}))).toBeNull();
    });

    it("импорт товаров недоступен сотруднику, контактов — доступен", async () => {
        const { org } = await makeOrg();
        const employee = await member(org, "employee");
        const { POST } = await import("@/app/api/import/preview/route");
        const body = (kind: string) => employee("/api/import/preview", "POST", { kind, text: "name\nA" });
        expect((await POST(body("products"))).status).toBe(401);
        expect((await POST(body("contacts"))).status).not.toBe(401);
    });
});

describe.skipIf(!hasDb)("календарь: сроки из других разделов", () => {
    it("счета и договоры видят только те, у кого есть финансы", async () => {
        const { org, userId } = await makeOrg();
        await prisma.invoice.create({ data: { org, number: "RE-1", customerName: "К", issueDate: "2026-01-01", dueDate: "2026-02-10", status: "sent" } });
        await prisma.contract.create({ data: { org, number: "D-1", customerName: "К", status: "active", endDate: "2026-02-12" } });
        const { GET } = await import("@/app/api/calendar/derived/route");
        const owner = asUser(userId);
        const employee = await member(org, "employee");
        const range = "?from=2026-02-01&to=2026-02-28";
        const ownerRows = await (await GET(owner(`/api/calendar/derived${range}`))).json();
        expect(ownerRows.map((r: any) => r.kind).sort()).toEqual(["contract", "invoice"]);
        const employeeRows = await (await GET(employee(`/api/calendar/derived${range}`))).json();
        expect(employeeRows).toEqual([]);
        expect((await GET(owner("/api/calendar/derived?from=x&to=y"))).status).toBe(400);
    });
});
