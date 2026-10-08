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
        expect(uz.hero).not.toEqual(en.hero); // лендинг на uz переведён
    });

    it("ключ, которого нет в uz, показывается по-английски (запасной словарь)", () => {
        expect(mergeMessages({ site: { a: "English A", b: "English B" } }, { site: { a: "Uzbek A" } })).toEqual({ site: { a: "Uzbek A", b: "English B" } });
    });

    it("слияние словарей: вложенные разделы объединяются, а не заменяются", () => {
        expect(mergeMessages({ a: { x: "1", y: "2" }, b: "3" }, { a: { x: "9" } })).toEqual({ a: { x: "9", y: "2" }, b: "3" });
    });

    it("префикс /uz убирается из пути", () => {
        expect(stripLocale("/uz/crm/crm")).toBe("/crm/crm");
        expect(stripLocale("/uz")).toBe("/");
    });
});

// Каждая строка перевода должна разбираться как сообщение ICU: неэкранированные «{{name}}» дают в браузере INVALID_MESSAGE и роняют страницу
describe("синтаксис ICU во всех переводах", () => {
    for (const loc of ["en", "de", "ua", "uz"] as const) {
        it(`${loc}: все строки разбираются`, async () => {
            const { IntlMessageFormat } = await import("intl-messageformat");
            const data = (await import(`../messages/${loc}.json`)).default as Record<string, unknown>;
            const bad: string[] = [];
            const walk = (o: Record<string, unknown>, path: string) => {
                for (const [k, v] of Object.entries(o)) {
                    if (v && typeof v === "object") walk(v as Record<string, unknown>, `${path}${k}.`);
                    else if (typeof v === "string") { try { new IntlMessageFormat(v, loc === "ua" ? "uk" : loc); } catch { bad.push(path + k); } }
                }
            };
            walk(data, "");
            expect(bad).toEqual([]);
        });
    }
});
