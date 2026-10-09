import { describe, expect, it } from "vitest";
import { permForPath, permsOf, isPerm } from "@/lib/access";
import { cleanModules } from "@/lib/practice/service";

describe("тонкие права специалиста", () => {
    it("адрес → нужное право", () => {
        expect(permForPath("/api/contracts/123")).toBe("contracts");
        expect(permForPath("/api/contract-templates")).toBe("contracts");
        expect(permForPath("/api/invoices")).toBe("invoices");
        expect(permForPath("/api/export")).toBe("export");
        expect(permForPath("/api/import/preview")).toBe("import");
        expect(permForPath("/api/contacts")).toBe("clients");
        expect(permForPath("/api/finance/settings")).toBeNull(); // реквизиты нужны любому, чтобы открылся экран
        expect(permForPath("/api/finance/vat")).toBe("reports");
        expect(permForPath("/api/tasks")).toBeNull();
    });
    it("cleanModules оставляет только известные права и подтягивает раздел", () => {
        const m = cleanModules(["p:contracts", "p:clients", "p:hack", "billing", "tasks"]);
        expect(m).toContain("p:contracts");
        expect(m).toContain("inventory");
        expect(m).toContain("crm");
        expect(m).toContain("tasks");
        expect(m).not.toContain("p:hack");
        expect(m).not.toContain("billing");
        expect(permsOf(m).sort()).toEqual(["clients", "contracts"]);
        expect(isPerm("p:export")).toBe(true);
        expect(isPerm("p:nope")).toBe(false);
    });
});
