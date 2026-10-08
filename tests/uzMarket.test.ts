import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser } from "./helpers/http";
import { uzFieldError, mergeUz, emptyUz } from "@/lib/validation/uz";
import { UZ_SEED, pickRule, uzVatOn, resetTaxRuleCache } from "@/lib/finance/taxRules";
import { buildUzVat } from "@/lib/finance/uz";
import { marketOf, marketHasDocument, marketDocumentLocale, profile, MARKET_DEFAULTS } from "@/lib/finance/market";
import { uzDocumentLabels } from "@/lib/finance/pdfLabelsUz";
import { renderDocumentPdf } from "@/lib/finance/pdf";
import { taxExempt, defaultRateFor, applyTaxPolicy } from "@/lib/finance/tax";
import { defaultContractText } from "@/lib/finance/contractText";
import { timeZoneFor } from "@/lib/office/routines";
import { PATCH as patchSettings, GET as getSettings } from "@/app/api/finance/settings/route";
import { GET as getReports } from "@/app/api/finance/reports/route";
import { GET as getRules } from "@/app/api/finance/tax-rules/route";

describe("рынок UZ: профиль", () => {
    it("UZ зарегистрирован с сумом, узбекским языком документов и узбекскими документами", () => {
        expect(marketOf("uz")).toBe("UZ");
        expect(profile("UZ").currencyDefault).toBe("UZS");
        expect(marketDocumentLocale("UZ")).toBe("uz");
        expect(marketHasDocument("UZ", "act")).toBe(true);
        expect(marketHasDocument("UZ", "tax_invoice")).toBe(true);
        expect(marketHasDocument("UZ", "fiscal_receipt")).toBe(false);
        expect(profile("UZ").integrations).toEqual(["cbu"]);
        expect(MARKET_DEFAULTS.UZ.currency).toBe("UZS");
        // немецкие и украинские функции в UZ не просачиваются
        expect(profile("UZ").features.dunning).toBe(false);
        expect(profile("UZ").features.fiscal).toBe(false);
    });
});

describe("валидаторы реквизитов UZ", () => {
    it("ПИНФЛ — ровно 14 цифр, МФО — 5, счёт — 20; пустое — не ошибка", () => {
        expect(uzFieldError("pinfl", "12345678901234")).toBeNull();
        expect(uzFieldError("pinfl", "1234567890123")).toBe("pinfl");
        expect(uzFieldError("mfo", "00014")).toBeNull();
        expect(uzFieldError("mfo", "0001")).toBe("mfo");
        expect(uzFieldError("account", "2020 8000 1234 5678 9012")).toBeNull();
        expect(uzFieldError("account", "123")).toBe("account");
        expect(uzFieldError("inn", "")).toBeNull();
        expect(uzFieldError("inn", "30 1234 567")).toBeNull();
        expect(uzFieldError("inn", "abc")).toBe("inn");
        expect(uzFieldError("vatRegDate", "2026-06-01")).toBeNull();
        expect(uzFieldError("vatRegDate", "01.06.2026")).toBe("date");
    });

    it("слияние сохраняет верные поля и оставляет прежнее значение у неверных", () => {
        const r = mergeUz({ ...emptyUz(), mfo: "00014" }, { inn: "301234567", mfo: "12", bank: "Test Bank", taxRegime: "weird", vatPayer: true, evil: "x" });
        expect(r.value.inn).toBe("301234567");
        expect(r.value.mfo).toBe("00014");
        expect(r.value.taxRegime).toBe("");
        expect(r.value.vatPayer).toBe(true);
        expect((r.value as unknown as Record<string, unknown>).evil).toBeUndefined();
        expect(r.errors).toEqual([{ field: "mfo", code: "mfo" }]);
    });
});

describe("налоговые правила на дату", () => {
    it("ставка считается по правилу, действовавшему на дату документа", async () => {
        resetTaxRuleCache();
        expect((await uzVatOn("2026-03-01")).rate).toBe(12);
        // упрощённый режим 6 % начинается с 1 июня 2026 — до этой даты общая ставка
        expect((await uzVatOn("2026-03-01", { regime: "simplified_vat6" })).rate).toBe(12);
        const after = await uzVatOn("2026-07-01", { regime: "simplified_vat6" });
        expect(after.rate).toBe(6);
        expect(after.inputVatCredit).toBe(false);
        // и после окончания режима (по 1 января 2030) — снова общая
        expect((await uzVatOn("2030-02-01", { regime: "simplified_vat6" })).rate).toBe(12);
        expect((await uzVatOn("2026-07-01", { exportSale: true })).rate).toBe(0);
        expect((await uzVatOn("2026-07-01", { vatPayer: false })).rate).toBe(0);
    });

    it("порог регистрации: до 1 июня 2026 — 1 млрд, после — 12 000 БРВ; дата вне диапазона помечается неточной", () => {
        const before = pickRule(UZ_SEED, "vat_registration_threshold", "2026-05-31");
        const after = pickRule(UZ_SEED, "vat_registration_threshold", "2026-06-01");
        expect(before?.rule.params.soum).toBe(1_000_000_000);
        expect(after?.rule.params.brv).toBe(12000);
        expect(pickRule(UZ_SEED, "vat_standard", "2020-01-01")?.exact).toBe(false);
    });

    it("все начальные записи не подтверждены — интерфейс показывает «Бета»", () => {
        expect(UZ_SEED.every((r) => r.verifiedBy === null)).toBe(true);
        expect(UZ_SEED.every((r) => r.source && r.sourceUrl)).toBe(true);
    });
});

describe("QQS: расчёт отчёта", () => {
    const items = [{ qty: 2, unitPrice: 1_000_000, taxRate: 12 }];
    it("общий режим: налог с продаж минус входной", () => {
        const r = buildUzVat({ from: "2026-07-01", to: "2026-07-31", invoices: [{ items }], creditNotes: [], expenses: [{ amount: 500_000, taxRate: 12 }], profile: { vatPayer: true, vatCode: "123456789" }, rules: UZ_SEED });
        expect(r.salesTax).toBe(240_000);
        expect(r.inputTax).toBe(60_000);
        expect(r.payable).toBe(180_000);
        expect(r.inputCreditAllowed).toBe(true);
        expect(r.warnings.map((w) => w.code)).toContain("rules_unverified");
    });
    it("упрощённый режим 6 %: входной налог не вычитается; строки по 12 % помечаются расхождением", () => {
        const r = buildUzVat({ from: "2026-07-01", to: "2026-07-31", invoices: [{ items }], creditNotes: [], expenses: [{ amount: 500_000, taxRate: 12 }], profile: { vatPayer: true, taxRegime: "simplified_vat6", vatCode: "1" }, rules: UZ_SEED });
        expect(r.inputTax).toBe(0);
        expect(r.inputCreditAllowed).toBe(false);
        expect(r.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["simplified_no_input_credit", "rate_mismatch"]));
    });
    it("не плательщик НДС: налог не начисляется", () => {
        const r = buildUzVat({ from: "2026-07-01", to: "2026-07-31", invoices: [{ items }], creditNotes: [], expenses: [], profile: { vatPayer: false }, rules: UZ_SEED });
        expect(r.salesTax).toBe(0);
        expect(r.warnings.map((w) => w.code)).toContain("not_vat_payer");
    });
});

describe("PDF узбекской фирмы", () => {
    it("названия документов двуязычные «uz / ru», по запросу только русские", () => {
        expect(uzDocumentLabels().invoice).toBe("Hisob-faktura / Счёт-фактура");
        expect(uzDocumentLabels("ru").invoice).toBe("Счёт-фактура");
        expect(uzDocumentLabels("uz").invoice).toBe("Hisob-faktura");
        expect(uzDocumentLabels().qty).toBe("Soni"); // мелкие подписи — на одном языке
    });
    it("PDF собирается с кириллицей и узбекскими апострофами", async () => {
        const buf = await renderDocumentPdf(
            { kind: "invoice", number: "HF-1", customer: { name: "«Тест» MChJ" }, items: [{ description: "Xizmat — ko‘rsatilgan", qty: 1, unitPrice: 1000000, taxRate: 12 }], currency: "UZS", issueDate: "2026-07-01" },
            { legalName: "Firmspace MChJ", address: "Toshkent", taxId: "STIR 301234567", iban: "20208000123456789012", bic: "00014", paymentTermsDays: 5, country: "UZ" },
            "uz"
        );
        expect(buf.subarray(0, 4).toString()).toBe("%PDF");
        expect(buf.length).toBeGreaterThan(2000);
    });
});

describe.skipIf(!hasDb)("API: настройки и отчёт UZ", () => {
    it("страна UZ принимается, реквизиты сохраняются, неверные поля сообщаются кодами", async () => {
        const { userId } = await makeOrg();
        const req = asUser(userId);
        const res = await patchSettings(req("/api/finance/settings", "PATCH", { country: "UZ", currency: "UZS", uz: { inn: "301234567", mfo: "12", bank: "Test Bank", vatPayer: true } }));
        const body = await res.json();
        expect(body.country).toBe("UZ");
        expect(body.uz.inn).toBe("301234567");
        expect(body.uz.bank).toBe("Test Bank");
        expect(body.uz.mfo).toBe("");
        expect(body.fieldErrors).toEqual([{ field: "uz.mfo", code: "mfo" }]);
        const again = await (await getSettings(req("/api/finance/settings"))).json();
        expect(again.settings.uz.inn).toBe("301234567");
    });

    it("отчёт uz-vat доступен только фирме рынка UZ; немецкая отчётность UZ-фирме закрыта", async () => {
        const uz = await makeOrg();
        await prisma.financeSettings.create({ data: { org: uz.org, country: "UZ" } });
        const de = await makeOrg();
        await prisma.financeSettings.create({ data: { org: de.org, country: "DE" } });
        const ok = await getReports(asUser(uz.userId)("/api/finance/reports?kind=uz-vat&period=month"));
        expect(ok.status).toBe(200);
        expect((await ok.json()).report.warnings.length).toBeGreaterThan(0);
        expect((await getReports(asUser(de.userId)("/api/finance/reports?kind=uz-vat&period=month"))).status).toBe(409);
        expect((await getReports(asUser(uz.userId)("/api/finance/reports?kind=vat&period=month"))).status).toBe(409);
    });

    it("список правил: рынок обязателен, записи с источниками, verified = false до подтверждения", async () => {
        const o = await makeOrg();
        const res = await getRules(asUser(o.userId)("/api/finance/tax-rules?market=UZ"));
        const body = await res.json();
        expect(body.verified).toBe(false);
        expect(body.rules.length).toBeGreaterThanOrEqual(5);
        expect((await getRules(asUser(o.userId)("/api/finance/tax-rules?market=XX"))).status).toBe(400);
    });
});

describe("налоговая политика UZ", () => {
    it("фирма без отметки «плательщик QQS» налог не начисляет; плательщик получает 12 %", () => {
        expect(taxExempt({ country: "UZ", uz: {} })).toBe(true);
        expect(taxExempt({ country: "UZ", uz: { vatPayer: true } })).toBe(false);
        expect(taxExempt({ country: "UZ", uz: { vatPayer: true, taxRegime: "self_employed" } })).toBe(true);
        expect(defaultRateFor({ country: "UZ", uz: { vatPayer: true } }, "2026-07-01")).toBe(12);
        expect(defaultRateFor({ country: "UZ", uz: { vatPayer: true, taxRegime: "simplified_vat6" } }, "2026-07-01")).toBe(6);
        expect(defaultRateFor({ country: "UZ", uz: { vatPayer: true, taxRegime: "simplified_vat6" } }, "2026-03-01")).toBe(12);
        expect(applyTaxPolicy([{ taxRate: null }, { taxRate: 0 }], { country: "UZ", uz: { vatPayer: true } }).map((i) => i.taxRate)).toEqual([12, 0]);
        expect(applyTaxPolicy([{ taxRate: 12 }], { country: "UZ", uz: {} })[0].taxRate).toBe(0);
    });
    it("часовой пояс и типовой договор рынка", () => {
        expect(timeZoneFor("UZ")).toBe("Asia/Tashkent");
        expect(timeZoneFor("DE")).toBe("Europe/Berlin");
        expect(defaultContractText("UZ")).toContain("SHARTNOMA");
        expect(defaultContractText("UZ")).toContain("ДОГОВОР");
    });
});
