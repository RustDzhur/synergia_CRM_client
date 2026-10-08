import { describe, it, expect } from "vitest";
import { marketOf, marketDocumentLocale, marketHasDocument, marketAllowsIntegration, isMarketSpecificIntegration, profile, registerMarket, registeredMarkets, type MarketProfile } from "@/lib/finance/market";

describe("реестр рынков", () => {
    it("DE и UA ведут себя как раньше", () => {
        expect(marketOf("de")).toBe("DE");
        expect(marketOf(" UA ")).toBe("UA");
        expect(marketOf("FR")).toBeNull();
        expect(marketOf(null)).toBeNull();
        expect(marketDocumentLocale("UA")).toBe("ua");
        expect(marketDocumentLocale("DE")).toBe("de");
        expect(marketDocumentLocale("")).toBeNull();
        expect(marketHasDocument("DE", "act")).toBe(false);
        expect(marketHasDocument("UA", "act")).toBe(true);
        expect(marketAllowsIntegration("DE", "novaposhta")).toBe(false);
        expect(marketAllowsIntegration("UA", "novaposhta")).toBe(true);
        expect(marketAllowsIntegration("DE", "telegram")).toBe(true);
        expect(profile("UA").nameGenitive).toBe("Украины");
    });

    it("новый рынок добавляется регистрацией профиля", () => {
        const base = profile("UA");
        const test: MarketProfile = { ...base, market: "ZZ", nameGenitive: "Зазии", currencyDefault: "ZZD", localeDefault: "en", integrations: [], documents: ["invoice"] };
        registerMarket(test);
        expect(registeredMarkets()).toContain("ZZ");
        expect(marketOf("zz")).toBe("ZZ");
        expect(marketDocumentLocale("ZZ")).toBe("en");
        expect(marketHasDocument("ZZ", "act")).toBe(false);
        expect(isMarketSpecificIntegration("novaposhta")).toBe(true);
    });

    it("незарегистрированный рынок — ошибка, а не молчаливая подмена на DE", () => {
        expect(() => profile("XX")).toThrow();
    });
});
