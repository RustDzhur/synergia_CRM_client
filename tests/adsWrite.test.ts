import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanError, buildMutation, createCampaign, setCampaignStatus, validatePlan } from "@/lib/ads/googleWrite";
import { toolsFor } from "@/lib/office/templates";

const good = () => ({
    name: "CRM Deutschland", url: "https://firmspace.de/crm", dailyBudget: 30, country: "de", language: "DE", locations: ["Berlin"], negatives: ["kostenlos", "Kostenlos", "jobs"],
    groups: [{ name: "CRM Software", keywords: [{ text: "CRM Software", match: "PHRASE" }, "crm für kmu", { text: "crm software", match: "PHRASE" }],
        headlines: ["CRM für Ihr Unternehmen", "Kunden und Aufträge im Tool", "Jetzt 14 Tage testen"], descriptions: ["Alle Kunden, Angebote und Rechnungen an einem Ort.", "Einfach starten, ohne Einrichtungsaufwand."], path1: "CRM" }],
});

describe("Google Ads: план кампании", () => {
    it("нормализует и проверяет лимиты Google Ads", () => {
        const { plan, warnings } = validatePlan(good());
        expect(plan.country).toBe("DE"); expect(plan.language).toBe("de");
        expect(plan.negatives).toEqual(["kostenlos", "jobs"]);
        expect(plan.groups[0].keywords).toHaveLength(2); // дубликат убран
        expect(warnings.join(" ")).toMatch(/headlines/);
        const long = good(); long.groups[0].headlines.push("Das ist eine viel zu lange Anzeigenüberschrift hier");
        expect(() => validatePlan(long)).toThrow(PlanError);
        const noUrl = good(); noUrl.url = "firmspace";
        expect(() => validatePlan(noUrl)).toThrow(/url/);
        const noBudget = good(); noBudget.dailyBudget = 0;
        expect(() => validatePlan(noBudget)).toThrow(/dailyBudget/);
        const fewDesc = good(); fewDesc.groups[0].descriptions = ["Nur eine"];
        expect(() => validatePlan(fewDesc)).toThrow(/descriptions/);
    });
    it("запрос создания: всё на паузе, один атомарный вызов", () => {
        const { plan } = validatePlan(good());
        const m = buildMutation("123-456-7890", plan, ["geoTargetConstants/1"], "languageConstants/1001", "t");
        const ops = m.mutateOperations as any[];
        const camp = ops.find((o) => o.campaignOperation).campaignOperation.create;
        expect(camp.status).toBe("PAUSED");
        expect(camp.resourceName).toBe("customers/1234567890/campaigns/-2");
        expect(ops.find((o) => o.campaignBudgetOperation).campaignBudgetOperation.create.amountMicros).toBe("30000000");
        expect(ops.filter((o) => o.adGroupAdOperation)).toHaveLength(1);
        expect(ops.filter((o) => o.campaignCriterionOperation?.create?.negative)).toHaveLength(2);
    });
    it("createCampaign и setCampaignStatus ходят в нужные адреса", async () => {
        const calls: { url: string; body: any }[] = [];
        vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
            const body = init?.body ? JSON.parse(init.body) : null;
            calls.push({ url: String(url), body });
            const u = String(url);
            let out: any = {};
            if (u.includes("geoTargetConstants:suggest")) out = { geoTargetConstantSuggestions: [{ geoTargetConstant: { resourceName: "geoTargetConstants/1003854", countryCode: "DE", targetType: "City" } }] };
            else if (u.includes("googleAds:search")) out = { results: [{ languageConstant: { resourceName: "languageConstants/1001" } }] };
            else if (u.includes("googleAds:mutate")) out = { mutateOperationResponses: [{ campaignBudgetResult: { resourceName: "x" } }, { campaignResult: { resourceName: "customers/1234567890/campaigns/555" } }] };
            return new Response(JSON.stringify(out), { status: 200, headers: { "content-type": "application/json" } });
        }));
        process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev";
        const { plan } = validatePlan(good());
        const r = await createCampaign("tok", "1234567890", plan);
        expect(r.campaignId).toBe("555");
        expect(calls.some((c) => c.url.endsWith("/customers/1234567890/googleAds:mutate"))).toBe(true);
        await setCampaignStatus("tok", "1234567890", "555", "ENABLED");
        const last = calls[calls.length - 1];
        expect(last.url).toContain("/campaigns:mutate");
        expect(last.body.operations[0].update.status).toBe("ENABLED");
    });
    afterEach(() => vi.unstubAllGlobals());
    it("навык ads даёт инструменты", () => {
        expect(toolsFor(["ads"])).toEqual(expect.arrayContaining(["ads_save_plan", "ads_apply_plan", "ads_set_status", "ads_keyword_ideas", "ads_account"]));
    });
});
