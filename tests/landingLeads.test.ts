import { describe, expect, it } from "vitest";
import { landingExternalId, landingSite, normalizeUtm, parseLandingLead } from "@/lib/landingLeads";

describe("приём заявок с лендингов (lib/landingLeads)", () => {
    // валидная заявка automatisation (message) — от неё отталкиваются негативные кейсы
    const valid = (extra: Record<string, unknown> = {}) => ({
        name: "Maria Müller",
        company: "Kanzlei Muster",
        email: "Maria.Mueller@Example.de",
        phone: "+49 30 1234567",
        message: "Wir suchen eine Lösung für die Belegverarbeitung mit DATEV.",
        ...extra,
    });

    it("принимает валидную заявку automatisation (message) и нормализует почту/utm", () => {
        const res = parseLandingLead(valid({ requestType: "process_analysis", sourcePage: "/demo", utm: { utm_source: "google", utm_medium: "cpc", utm_campaign: "spring" } }));
        expect(res.lead).toBeTruthy();
        expect(res.errors).toBeUndefined();
        expect(res.lead!.textField).toBe("message");
        expect(res.lead!.email).toBe("maria.mueller@example.de");
        expect(res.lead!.requestType).toBe("process_analysis");
        expect(res.lead!.utm).toEqual({ source: "google", medium: "cpc", campaign: "spring", term: "", content: "", gclid: "" });
    });

    it("принимает валидную заявку burokratie (processDescription) с utm вида source/medium", () => {
        const res = parseLandingLead({
            name: "Max Mustermann",
            company: "Steuerkanzlei",
            email: "max@kanzlei.de",
            processDescription: "Aktuell scannen wir Belege manuell und buchen sie in DATEV.",
            mandantCount: "10-49",
            belegVolume: "200",
            datevWorkflow: "manuell",
            contactChannel: "email",
            consent: true,
            utm: { source: "newsletter", medium: "email", campaign: "q4" },
        });
        expect(res.lead).toBeTruthy();
        expect(res.lead!.textField).toBe("processDescription");
        expect(res.lead!.text).toContain("Belege");
        expect(res.lead!.utm.source).toBe("newsletter");
        expect(res.lead!.consent).toBe(true);
    });

    it("имя короче двух символов — ошибка name", () => {
        const res = parseLandingLead(valid({ name: "A" }));
        expect(res.lead).toBeUndefined();
        expect(res.errors!.name).toBeTruthy();
    });

    it("некорректная почта — ошибка email", () => {
        const res = parseLandingLead(valid({ email: "not-an-email" }));
        expect(res.lead).toBeUndefined();
        expect(res.errors!.email).toBeTruthy();
    });

    it("текст короче 10 символов — ошибка по тому полю, которое прислал лендинг", () => {
        const res = parseLandingLead(valid({ message: "kurz" }));
        expect(res.lead).toBeUndefined();
        expect(res.errors!.message).toBeTruthy();
        const res2 = parseLandingLead(valid({ message: "", processDescription: "kurz" }));
        expect(res2.lead).toBeUndefined();
        expect(res2.errors!.processDescription).toBeTruthy();
    });

    it("нет тела — ошибки всех обязательных полей", () => {
        const res = parseLandingLead(null);
        expect(res.lead).toBeUndefined();
        expect(res.errors).toEqual(expect.objectContaining({ name: expect.any(String), email: expect.any(String), message: expect.any(String) }));
    });

    it("обрезает длины: name/company 200, email 254, phone 64, текст 4000", () => {
        const res = parseLandingLead(valid({
            name: "x".repeat(300),
            company: "y".repeat(300),
            phone: "1".repeat(100),
            message: "lorem ipsum dolor sit amet ".repeat(400),
        }));
        expect(res.lead).toBeTruthy();
        expect(res.lead!.name.length).toBe(200);
        expect(res.lead!.company.length).toBe(200);
        expect(res.lead!.phone.length).toBe(64);
        expect(res.lead!.text.length).toBe(4000);
    });

    it("обесценивает requestType до demo/process_analysis", () => {
        expect(parseLandingLead(valid({ requestType: "demo" })).lead!.requestType).toBe("demo");
        expect(parseLandingLead(valid({ requestType: "spam" })).lead!.requestType).toBe("");
        expect(parseLandingLead(valid()).lead!.requestType).toBe("");
    });

    it("нормализует utm из обоих видов ключей и не падает на мусоре", () => {
        expect(normalizeUtm({ utm_source: "a", utm_medium: "b", gclid: "g" })).toEqual({ source: "a", medium: "b", campaign: "", term: "", content: "", gclid: "g" });
        expect(normalizeUtm({ source: "x", campaign: "y" }).source).toBe("x");
        expect(normalizeUtm("utm")).toEqual({ source: "", medium: "", campaign: "", term: "", content: "", gclid: "" });
        expect(normalizeUtm({ utm_source: 42 })).toEqual({ source: "", medium: "", campaign: "", term: "", content: "", gclid: "" });
    });

    it("ключ дедупликации — <site>:<id запроса>", () => {
        expect(landingExternalId("copilot", "abc-123")).toBe("copilot:abc-123");
        expect(landingExternalId("automatisation", "x")).toBe("automatisation:x");
    });

    it("site из config интеграции: любая валидная метка приводится к нижнему регистру", () => {
        expect(landingSite({ site: "copilot" })).toBe("copilot");
        expect(landingSite({ site: "automatisation" })).toBe("automatisation");
        expect(landingSite({ site: "My-Site" })).toBe("my-site");
        expect(landingSite({ site: "my_site-2" })).toBe("my_site-2");
    });

    it("невалидная или отсутствующая метка site — пусто", () => {
        expect(landingSite({})).toBe("");
        expect(landingSite(null)).toBe("");
        expect(landingSite({ site: 42 })).toBe(""); // не строка
        expect(landingSite({ site: "a" })).toBe(""); // короче двух символов
        expect(landingSite({ site: "-abc" })).toBe(""); // начинается с дефиса
        expect(landingSite({ site: "a b" })).toBe(""); // пробел
        expect(landingSite({ site: "x".repeat(32) })).toBe(""); // длиннее 31 символа
    });
});
