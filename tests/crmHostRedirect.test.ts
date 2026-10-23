import { describe, expect, it } from "vitest";
import { cleanHost, crmHostRedirect } from "@/lib/crmHostRedirect";

describe("crm.firmspace.de: вход вместо маркетинга (lib/crmHostRedirect)", () => {
    it("маркетинговые пути на crm.firmspace.de ведут на страницу входа", () => {
        expect(crmHostRedirect("crm.firmspace.de", "/")).toBe("/login");
        expect(crmHostRedirect("crm.firmspace.de", "/features")).toBe("/login");
        expect(crmHostRedirect("crm.firmspace.de", "/about")).toBe("/login");
        expect(crmHostRedirect("crm.firmspace.de", "/blog")).toBe("/login");
        expect(crmHostRedirect("crm.firmspace.de", "/blog/2026-10-04-ai-v-avtomatizacii")).toBe("/login");
        expect(crmHostRedirect("crm.firmspace.de", "/contacts")).toBe("/login");
        expect(crmHostRedirect("crm.firmspace.de", "/documentation")).toBe("/login");
        expect(crmHostRedirect("crm.firmspace.de", "/agb")).toBe("/login");
    });

    it("locale из пути сохраняется в адресе входа", () => {
        expect(crmHostRedirect("crm.firmspace.de", "/de/features")).toBe("/de/login");
        expect(crmHostRedirect("crm.firmspace.de", "/ua")).toBe("/ua/login");
        expect(crmHostRedirect("crm.firmspace.de", "/en/blog/some-post")).toBe("/en/login");
    });

    it("пути входа и приложения не редиректят — петли нет", () => {
        for (const p of [
            "/login", "/de/login", "/en/login", "/ua/login",
            "/crm", "/crm/crm", "/de/crm/settings/integration",
            "/pay", "/pay/done",
            "/c", "/c/abc123",
        ]) {
            expect(crmHostRedirect("crm.firmspace.de", p)).toBe("");
        }
    });

    it("другие хосты не трогаем: маркетинг работает как раньше", () => {
        for (const host of ["firmspace.de", "www.firmspace.de", "localhost", "localhost:3000", "crm.firmspace.de.evil.example"]) {
            expect(crmHostRedirect(host, "/")).toBe("");
            expect(crmHostRedirect(host, "/features")).toBe("");
            expect(crmHostRedirect(host, "/de/about")).toBe("");
        }
    });

    it("регистр и порт host не мешают определению", () => {
        expect(cleanHost("CRM.Firmspace.DE:3210")).toBe("crm.firmspace.de");
        expect(crmHostRedirect("CRM.Firmspace.DE", "/about")).toBe("/login");
        expect(crmHostRedirect("crm.firmspace.de:3000", "/about")).toBe("/login");
    });
});
