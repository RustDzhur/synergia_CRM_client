import { describe, expect, it } from "vitest";
import { isLocale, isFullLocale, pickLocale, LOCALES } from "@/lib/locales";
import { loadMessages, mergeMessages } from "@/lib/messages";
import { stripLocale } from "@/utils/locale";

describe("языки платформы", () => {
    it("uz — поддерживаемый язык, но без полных таблиц текстов", () => {
        expect(LOCALES).toContain("uz");
        expect(isLocale("uz")).toBe(true);
        expect(isFullLocale("uz")).toBe(false);
        expect(isFullLocale("ua")).toBe(true);
        expect(pickLocale("fr")).toBe("en");
        expect(pickLocale("uz")).toBe("uz");
    });

    it("недостающие ключи узбекского берутся из английского, а не показываются как ключи", async () => {
        const uz = (await loadMessages("uz")) as { navigation: { dashboard: string }; hero: unknown; finance: { tab_invoices: string } };
        const en = (await loadMessages("en")) as { hero: unknown };
        expect(uz.navigation.dashboard).toBe("Bosh sahifa");
        expect(uz.finance.tab_invoices).toBe("Hisob-fakturalar");
        expect(uz.hero).toEqual(en.hero); // сайт на uz пока не переведён — английский
    });

    it("слияние словарей: вложенные разделы объединяются, а не заменяются", () => {
        expect(mergeMessages({ a: { x: "1", y: "2" }, b: "3" }, { a: { x: "9" } })).toEqual({ a: { x: "9", y: "2" }, b: "3" });
    });

    it("префикс /uz убирается из пути", () => {
        expect(stripLocale("/uz/crm/crm")).toBe("/crm/crm");
        expect(stripLocale("/uz")).toBe("/");
    });
});
