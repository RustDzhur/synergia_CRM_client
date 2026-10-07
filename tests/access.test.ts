import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import path from "node:path";
import { canAccess, moduleForPath, canImportKind, OPEN_API_SEGMENTS, type Role } from "@/lib/access";
import { featureForApi } from "@/lib/features";

const api = path.join(__dirname, "..", "app", "api");
const segments = readdirSync(api, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

describe("карта прав API", () => {
    it("каждый раздел app/api либо закреплён за модулем, либо явно открыт", () => {
        const unclassified = segments.filter((s) => moduleForPath(`/api/${s}`, "GET") === "deny");
        expect(unclassified).toEqual([]);
    });

    it("неизвестный адрес закрыт для всех, включая владельца", () => {
        for (const role of ["owner", "admin", "manager", "employee", "viewer"] as Role[]) {
            expect(canAccess(role, [], moduleForPath("/api/new-secret-thing", "GET"), "GET")).toBe(false);
        }
    });

    it("открытый список не содержит несуществующих разделов", () => {
        for (const s of OPEN_API_SEGMENTS) expect(segments).toContain(s);
    });

    const money = ["bank/accounts", "bank/transactions", "stock", "suppliers", "purchases", "warehouses", "production", "recurring-invoices", "supplier-invoices", "stock-docs", "issued-docs", "assets", "reconciliation", "pos", "boms", "production-orders", "novaposhta/x", "ukrposhta"];
    it.each(money)("сотрудник и наблюдатель не видят /api/%s", (p) => {
        for (const role of ["employee", "viewer"] as Role[]) expect(canAccess(role, [], moduleForPath(`/api/${p}`, "GET"), "GET")).toBe(false);
        expect(canAccess("manager", [], moduleForPath(`/api/${p}`, "GET"), "GET")).toBe(true);
    });

    it("выгрузка зависит от вида данных", () => {
        const q = (kind: string) => new URLSearchParams({ kind });
        expect(canAccess("employee", [], moduleForPath("/api/export", "GET", q("contacts")), "GET")).toBe(true);
        expect(canAccess("employee", [], moduleForPath("/api/export", "GET", q("invoices")), "GET")).toBe(false);
        expect(canAccess("employee", [], moduleForPath("/api/export", "GET"), "GET")).toBe(false);
        expect(featureForApi("/api/export", q("contacts"))).toBe("crm");
        expect(featureForApi("/api/export", q("invoices"))).toBe("inventory");
    });

    it("загрузка файла: контакты — CRM, товары — финансы", () => {
        const employee = { role: "employee" as Role, modules: [] as string[] };
        expect(canImportKind(employee, "contacts")).toBe(true);
        expect(canImportKind(employee, "products")).toBe(false);
        expect(canImportKind(employee, "unknown")).toBe(false);
    });

    it("наблюдатель ничего не меняет", () => {
        expect(canAccess("viewer", [], moduleForPath("/api/contacts", "POST"), "POST")).toBe(false);
    });

    it("тариф проверяется и для остальной бухгалтерии", () => {
        for (const s of ["bank", "stock", "suppliers", "purchases", "warehouses"]) expect(featureForApi(`/api/${s}`)).toBe("inventory");
    });
});
