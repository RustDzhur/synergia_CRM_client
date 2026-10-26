import { describe, expect, it } from "vitest";
import { extractExpenseFields, parseAmount, parseDateText, classifyExpense } from "@/lib/finance/expenseExtract";
import { mergeAutofill, normalizeAmounts } from "@/lib/finance/expenseTax";
import { catalogChildren, catalogDefaults, catalogEntry, datevAccountFor, EXPENSE_CATEGORY_CATALOG, EXPENSE_CATEGORY_GROUPS } from "@/lib/finance/expenseCatalog";
import { EXPENSE_EXPORT_COLUMNS, expenseExportRow } from "@/lib/finance/expenseExport";
import { inputVatByRate } from "@/lib/finance/reportMath";
import { ExpenseInputError, manualFieldsAfterPatch, normalizeIban, parseExpenseFields } from "@/lib/finance/expenseInput";

const opts = { defaultRate: 19, today: "2026-10-26" } as const;
const ex = (text: string, meta?: Parameters<typeof extractExpenseFields>[0]["meta"]) =>
    extractExpenseFields({ text, meta, ...opts });

describe("expense parser: Beträge", () => {
    it("liest Netto, USt und Brutto aus den beschrifteten Zeilen", () => {
        const r = ex("Bürobedarf\nNetto 100,00 €\nUSt 19 % 19,00 €\nBrutto 119,00 €");
        expect(r.fields.netAmount).toBe(100);
        expect(r.fields.vatAmount).toBe(19);
        expect(r.fields.grossAmount).toBe(119);
        expect(r.fields.taxRate).toBe(19);
    });

    it("berechnet Netto aus Brutto und 19 % (Brutto-only-Beleg)", () => {
        const r = ex("Bürobedarf\nGesamtbetrag 59,50 € inkl. 19 % MwSt.");
        expect(r.fields.grossAmount).toBe(59.5);
        expect(r.fields.netAmount).toBe(50);
        expect(r.fields.vatAmount).toBe(9.5);
        expect(r.fields.taxRate).toBe(19);
    });

    it("kleine Brutto-Summe wird nicht von der 19-%-Angabe überschrieben", () => {
        const r = ex("Bürobedarf\nBrutto 5,00 € inkl. 19 % MwSt.");
        expect(r.fields.grossAmount).toBe(5);
        expect(r.fields.vatAmount).toBe(0.8);
        expect(r.fields.netAmount).toBe(4.2);
    });

    it("wendet 7 % aus dem Beleg an (Buch)", () => {
        const r = ex("Fachbuch\nGesamtbetrag 9,99 € inkl. 7 % MwSt.");
        expect(r.fields.taxRate).toBe(7);
        expect(r.fields.grossAmount).toBe(9.99);
        expect(r.fields.netAmount).toBe(9.34);
        expect(r.fields.vatAmount).toBe(0.65);
    });

    it("liest englische Beträge mit Tausenderpunkt und USD", () => {
        const r = ex("Office supplies\nInvoice No: INV-2026-0042\nTotal $1,250.00\nVAT 19 %");
        expect(r.fields.grossAmount).toBe(1250);
        expect(r.fields.taxRate).toBe(19);
        expect(r.fields.currency).toBe("USD");
        expect(r.fields.documentNumber).toBe("INV-2026-0042");
    });

    it("versteht deutsche Tausendertrennung (1.234,56)", () => {
        const r = ex("Büromaterial\nBetrag 1.234,56 €");
        expect(r.fields.grossAmount).toBe(1234.56);
    });

    it("bei Netto + USt ohne Brutto wird Brutto ergänzt", () => {
        const r = ex("Bürobedarf\nNetto 100,00 €\nUSt 19 % 19,00 €");
        expect(r.fields.netAmount).toBe(100);
        expect(r.fields.vatAmount).toBe(19);
        expect(r.fields.grossAmount).toBe(119);
    });

    it("bei Netto + Steuersatz wird USt/Brutto ergänzt", () => {
        const r = ex("Bürobedarf\nNetto 100,00 € zzgl. 19 % USt");
        expect(r.fields.grossAmount).toBe(119);
        expect(r.fields.vatAmount).toBe(19);
    });

    it("bei reiner USt-Zeile lässt sich die Bemessungsgrundlage rekonstruieren", () => {
        const r = ex("Bürobedarf\nUSt 19 % 19,00 €");
        expect(r.fields.vatAmount).toBe(19);
        expect(r.fields.netAmount).toBe(100);
        expect(r.fields.grossAmount).toBe(119);
    });

    it("Datum wird nicht als Betrag gelesen", () => {
        const r = ex("Rechnungsdatum: 03.10.2026\nBrutto 119,00 €");
        expect(r.fields.grossAmount).toBe(119);
        expect(r.fields.documentDate).toBe("2026-10-03");
    });

    it("US-Datum wird nicht als Betrag gelesen", () => {
        const r = ex("Date: 03/15/2026\nTotal 99,00 €");
        expect(r.fields.grossAmount).toBe(99);
        expect(r.fields.documentDate).toBe("2026-03-15");
    });
});

describe("expense parser: Datum und Belegnummer", () => {
    it("Rechnungsdatum im deutschen Format", () => {
        expect(ex("Rechnungsdatum: 03.10.2026").fields.documentDate).toBe("2026-10-03");
    });

    it("ISO-Datum", () => {
        expect(ex("Belegdatum 2026-09-15").fields.documentDate).toBe("2026-09-15");
    });

    it("deutsches Tagesdatum mit Schrägstrichen", () => {
        expect(ex("Datum: 15/09/2026").fields.documentDate).toBe("2026-09-15");
    });

    it("Monatsname", () => {
        expect(ex("Rechnung vom 3. Oktober 2026").fields.documentDate).toBe("2026-10-03");
    });

    it("Zahlungsdatum wird getrennt von der Belegdatum erkannt", () => {
        const r = ex("Rechnungsdatum: 03.10.2026\nZahlungsdatum: 10.10.2026");
        expect(r.fields.documentDate).toBe("2026-10-03");
        expect(r.fields.paidDate).toBe("2026-10-10");
    });

    it("Rechnungsnummer mit Präfix", () => {
        expect(ex("Rechnungsnummer: RE-2026-0815").fields.documentNumber).toBe("RE-2026-0815");
    });

    it("Beleg-Nr. und Invoice No", () => {
        expect(ex("Beleg-Nr.: 4711").fields.documentNumber).toBe("4711");
        expect(ex("Invoice No: INV-2026-0042").fields.documentNumber).toBe("INV-2026-0042");
    });

    it("Fallback-Nummer RG-2026-77", () => {
        expect(ex("RG-2026-77\nBetrag 10,00 €").fields.documentNumber).toBe("RG-2026-77");
    });

    it("Rechnungsdatum wird nicht als Rechnungsnummer ausgegeben", () => {
        expect(ex("Rechnungsdatum: 03.10.2026").fields.documentNumber).toBe("");
    });
});

describe("expense parser: Lieferant und Rechnungsdaten", () => {
    it("USt-IdNr. wird erkannt, aber nicht als Betrag", () => {
        const r = ex("Bürobedarf\nUSt-IdNr.: DE123456789\nBrutto 119,00 €");
        expect(r.fields.vendorVatId).toBe("DE123456789");
        expect(r.fields.grossAmount).toBe(119);
    });

    it("IBAN mit gültiger Prüfsumme", () => {
        expect(ex("IBAN: DE89 3704 0044 0532 0130 00").fields.vendorIban).toBe("DE89370400440532013000");
    });

    it("IBAN mit falscher Prüfsumme wird mit Warnung übernommen", () => {
        const r = ex("IBAN: DE00 3704 0044 0532 0130 00");
        expect(r.fields.vendorIban).toBe("DE00370400440532013000");
        expect(r.warnings.map((w) => w.code)).toContain("iban_checksum");
    });

    it("bekannter Lieferant gewinnt gegen generische Firmenzeile", () => {
        const r = ex("MediaMarkt\nLaptop 1.199,00 €\nBrutto 1.199,00 €\nUSt 19 %");
        expect(r.fields.vendor).toBe("MediaMarkt");
        expect(r.fields.subcategory).toBe("hardware");
        expect(r.fields.bookingKind).toBe("Investition");
    });

    it("короткое имя поставщика не находится внутри обычного слова", () => {
        const r = ex("Metadaten zum Beleg\nBrutto 10,00 €");
        expect(r.fields.vendor).not.toBe("Meta");
    });

    it("Firmenzeile mit Rechtsform wird als Lieferant erkannt", () => {
        expect(ex("Muster Handel GmbH\nRechnungsnummer: 1\nBrutto 10,00 €").fields.vendor).toBe("Muster Handel GmbH");
    });

    it("Metadaten haben Vorrang vor dem Text", () => {
        const r = ex("Irgendein Text", { vendor: "ACME GmbH", grossAmount: 119, taxRate: 19, date: "2026-10-03" });
        expect(r.fields.vendor).toBe("ACME GmbH");
        expect(r.fields.netAmount).toBe(100);
        expect(r.fields.documentDate).toBe("2026-10-03");
    });

    it("категория из метаданных важнее классификатора", () => {
        const r = ex("Irgendein Text ohne Schlüsselwörter", { subcategory: "miete" });
        expect(r.fields.categoryCode).toBe("raum");
        expect(r.fields.subcategory).toBe("miete");
        expect(r.fields.datevAccount).toBe("4210");
    });
});

describe("expense classifier: категории ELSTER/DATEV", () => {
    const cases: Array<[string, string]> = [
        ["Miete für die Bürofläche", "miete"],
        ["Adobe Creative Cloud Abonnement", "software_abos"],
        ["Deutsche Bahn Fahrkarte Berlin–München", "reisekosten"],
        ["Aral Tankstelle Diesel", "kfz_betriebskosten"],
        ["Büromaterial Druckerpapier und Toner", "buerobedarf"],
        ["Buchführungskosten DATEV", "buchfuehrung"],
        ["Hosting IONOS", "hosting_domain"],
        ["Telekom Mobilfunk Rechnung", "telefon_internet"],
        ["Fortbildung Seminar", "fortschbildung"],
        ["Reinigung der Büroräume", "reinigung"],
        ["Gewerbesteuer Vorauszahlung", "gewerbesteuer"],
        ["Privatentnahme", "privatentnahme"],
        ["Geschenk für Kunden", "geschenke"],
        ["Spende", "spenden"],
        ["Zinsen", "zinsen"],
        ["Bewirtung Geschäftsessen", "bewirtung"],
        ["Büromöbel Schreibtisch IKEA", "bueromoebel"],
        ["Kfz-Versicherung HUK", "kfz_versicherung"],
        ["Betriebshaftpflichtversicherung", "betriebshaftpflicht"],
        ["Online-Werbung Google Ads", "werbung_online"],
        ["Verpackungsmaterial", "verpackung"],
        ["Fremdleistungen Subunternehmer", "fremdleistungen"],
        ["Handelswaren", "handelswaren"],
        ["Taxi zum Kunden", "reisekosten"],
    ];
    for (const [text, code] of cases) {
        it(`«${text}» → ${code}`, () => {
            expect(ex(text).fields.subcategory).toBe(code);
        });
    }

    it("ohne Signal entsteht Sonstiges mit niedriger Kategorie-Sicherheit", () => {
        const r = ex("Unbekannter Beleg ohne klare Angaben");
        expect(r.fields.subcategory).toBe("sonstiges_allgemein");
        expect(r.confidenceByField.category ?? 0).toBeLessThan(0.4);
        expect(r.reviewStatus).toBe("REVIEW");
    });

    it("classifyExpense liefert Gruppe und Sicherheit", () => {
        const match = classifyExpense("Miete für die Bürofläche", "");
        expect(match.leaf.code).toBe("miete");
        expect(match.group?.code).toBe("raum");
        expect(match.confidence).toBeGreaterThan(0.3);
    });
});

describe("expense parser: Steuerregeln", () => {
    it("Reverse Charge: 0 % USt, Vorsteuer abziehbar, Warnung", () => {
        const r = ex("Reverse Charge §13b UStG\nUSt 0 %");
        expect(r.fields.taxRate).toBe(0);
        expect(r.fields.inputVatDeductible).toBe(true);
        expect(r.warnings.map((w) => w.code)).toContain("reverse_charge");
    });

    it("Kleinunternehmer §19: 0 % und kein Vorsteuerabzug", () => {
        const r = ex("Gemäß §19 UStG wird keine Umsatzsteuer berechnet.\nGesamtbetrag 50,00 €");
        expect(r.fields.taxRate).toBe(0);
        expect(r.fields.inputVatDeductible).toBe(false);
        expect(r.warnings.map((w) => w.code)).toContain("kleinunternehmer");
    });

    it("Vorsteuer nicht abziehbar wird übernommen", () => {
        const r = ex("Bürobedarf\nVorsteuer nicht abziehbar\nNetto 100,00 € zzgl. 19 % USt");
        expect(r.fields.inputVatDeductible).toBe(false);
    });

    it("Investition/AfA: Nutzungsdauer aus dem Text", () => {
        const r = ex("Laptop MacBook Pro\nBrutto 1.499,00 € inkl. 19 % USt\nNutzungsdauer 3 Jahre");
        expect(r.fields.subcategory).toBe("hardware");
        expect(r.fields.bookingKind).toBe("Investition");
        expect(r.fields.afaYears).toBe(3);
        expect(r.fields.datevAccount).toBe("0490");
    });

    it("Investition/AfA: SKR04 wählt den SKR04-Zähler", () => {
        const r = extractExpenseFields({ text: "Laptop MacBook Pro\nNutzungsdauer 3 Jahre", defaultRate: 19, chart: "SKR04", today: "2026-10-26" });
        expect(r.fields.datevAccount).toBe("0690");
    });

    it("AfA: Kategorie liefert die Nutzungsdauer, wenn sie im Text fehlt", () => {
        const r = ex("Büromöbel IKEA\nInvestition\nBrutto 500,00 € inkl. 19 % USt");
        expect(r.fields.bookingKind).toBe("Investition");
        expect(r.fields.afaYears).toBe(13);
    });

    it("Privatentnahme: kein Vorsteuerabzug", () => {
        const r = ex("Privatentnahme 200,00 €");
        expect(r.fields.subcategory).toBe("privatentnahme");
        expect(r.fields.bookingKind).toBe("Privatentnahme");
        expect(r.fields.inputVatDeductible).toBe(false);
    });

    it("keine Beträge: Warnung no_amount und niedrige Sicherheit", () => {
        const r = ex("Nur ein Text ohne Zahlen");
        expect(r.warnings.map((w) => w.code)).toContain("no_amount");
        expect(r.confidence).toBeLessThan(0.5);
        expect(r.reviewStatus).toBe("REVIEW");
    });

    it("vollständiger Beleg mit klarer Kategorie: AUTO", () => {
        const r = ex("Office Depot\nBürobedarf\nRechnungsnummer: RE-2026-1\nRechnungsdatum: 03.10.2026\nUSt-IdNr.: DE123456789\nIBAN: DE89 3704 0044 0532 0130 00\nNetto 100,00 €\nUSt 19 % 19,00 €\nBrutto 119,00 €");
        expect(r.confidence).toBeGreaterThanOrEqual(0.8);
        expect(r.reviewStatus).toBe("AUTO");
        expect(r.evidence.length).toBeGreaterThan(0);
    });
});

describe("amount and merge arithmetic", () => {
    it("normalizeAmounts: Netto+Brutto ergeben die USt", () => {
        const a = normalizeAmounts({ net: 100, gross: 119, rate: 19 });
        expect([a.netAmount, a.vatAmount, a.grossAmount, a.taxRate]).toEqual([100, 19, 119, 19]);
    });

    it("normalizeAmounts: Brutto+7 % ergeben Netto/USt", () => {
        const a = normalizeAmounts({ gross: 107, rate: 7 });
        expect(a.netAmount).toBe(100);
        expect(a.vatAmount).toBe(7);
    });

    it("normalizeAmounts: nur USt+19 % ergeben die Basis", () => {
        const a = normalizeAmounts({ vat: 19, rate: 19 });
        expect(a.netAmount).toBe(100);
        expect(a.grossAmount).toBe(119);
    });

    it("normalizeAmounts: Null in Netto (поле не заполнено) не съедает Brutto", () => {
        const a = normalizeAmounts({ net: 0, gross: 119, vat: 0, rate: 19 });
        expect(a.netAmount).toBe(100);
        expect(a.vatAmount).toBe(19);
        expect(a.grossAmount).toBe(119);
    });

    it("mergeAutofill lässt manuell gepflegte Felder unangetastet", () => {
        const current = { manualFields: ["categoryCode"], categoryCode: "manuel", vendor: "Alt", reviewStatus: "REVIEW" };
        const proposal = ex("Office Depot\nMiete für die Bürofläche\nBrutto 119,00 € inkl. 19 % USt");
        const merged = mergeAutofill(current, proposal.fields, ["categoryCode", "vendor"], { confidence: 0.9 });
        expect(merged.skipped).toContain("categoryCode");
        expect(merged.applied).toContain("vendor");
        expect(merged.data.categoryCode).toBeUndefined();
        expect(merged.data.vendor).toBe("Office Depot");
    });

    it("mergeAutofill mit overwrite überschreibt auch manuelle Felder", () => {
        const current = { manualFields: ["categoryCode"], categoryCode: "manuel", vendor: "Alt", reviewStatus: "REVIEW" };
        const proposal = ex("Miete für die Bürofläche");
        const merged = mergeAutofill(current, proposal.fields, ["categoryCode"], { overwrite: true, confidence: 0.9 });
        expect(merged.applied).toContain("categoryCode");
        expect(merged.data.categoryCode).toBe("raum");
    });

    it("mergeAutofill behält OK-Status ohne overwrite", () => {
        const current = { manualFields: [], vendor: "Alt", reviewStatus: "OK" };
        const proposal = ex("Office Depot\nBürobedarf\nBrutto 119,00 € inkl. 19 % USt");
        const merged = mergeAutofill(current, proposal.fields, ["vendor", "grossAmount"], { confidence: 0.95 });
        expect(merged.reviewStatus).toBe("OK");
    });

    it("parseAmount versteht deutsche und englische Schreibweise", () => {
        expect(parseAmount("1.234,56")).toBe(1234.56);
        expect(parseAmount("1,234.56")).toBe(1234.56);
        expect(parseAmount("119,00")).toBe(119);
        expect(parseAmount("0,07")).toBe(0.07);
    });

    it("Vorsteuer nicht abziehbar bleibt Netto, zählt aber nicht in Kz 66", () => {
        const lines = inputVatByRate(
            [
                { amount: 100, taxRate: 19, vatAmount: 19, inputVatDeductible: true },
                { amount: 100, taxRate: 19, vatAmount: 19, inputVatDeductible: false },
            ],
            false
        );
        expect(lines[0].net).toBe(200);
        expect(lines[0].tax).toBe(19);
    });

    it("parseDateText prüft Kalendergrenzen", () => {
        expect(parseDateText("31.02.2026")).toBe("");
        expect(parseDateText("29.02.2024")).toBe("2024-02-29");
        expect(parseDateText("03/15/2026")).toBe("2026-03-15");
    });
});

describe("expense input parsing", () => {
    it("категория из справочника заполняет счёт, папку и название", () => {
        const parsed = parseExpenseFields(
            { vendor: "X", amount: 100, taxRate: 19, categoryCode: "buero", subcategory: "buerobedarf", documentDate: "2026-10-03" },
            { chart: "SKR03", mode: "create" }
        );
        expect(parsed.netAmount).toBe(100);
        expect(parsed.vatAmount).toBe(19);
        expect(parsed.grossAmount).toBe(119);
        expect(parsed.category).toBe("Bürobedarf");
        expect(parsed.datevAccount).toBe("4930");
        expect(parsed.folder).toBe("Belege/Buero");
        expect(parsed.date).toBe("2026-10-03");
    });

    it("только Brutto даёт Netto/USt, нулевой Netto не мешает", () => {
        const parsed = parseExpenseFields({ vendor: "X", netAmount: 0, grossAmount: 119, taxRate: 19 }, { chart: "SKR03", mode: "create" });
        expect(parsed.netAmount).toBe(100);
        expect(parsed.vatAmount).toBe(19);
        expect(parsed.grossAmount).toBe(119);
    });

    it("PATCH только с Netto не обнуляет сохранённую ставку", () => {
        const parsed = parseExpenseFields({ netAmount: 100 }, { chart: "SKR03", mode: "patch" });
        expect(parsed.netAmount).toBe(100);
        expect(parsed.taxRate).toBeUndefined();
    });

    it("PATCH только с Brutto считает налог по сохранённой ставке", () => {
        const parsed = parseExpenseFields({ grossAmount: 119 }, { chart: "SKR03", mode: "patch", currentTaxRate: 19 });
        expect(parsed.netAmount).toBe(100);
        expect(parsed.vatAmount).toBe(19);
        expect(parsed.grossAmount).toBe(119);
        expect(parsed.taxRate).toBeUndefined();
    });

    it("очистка категории сбрасывает и подкатегорию", () => {
        const parsed = parseExpenseFields({ categoryCode: "", subcategory: "" }, { chart: "SKR03", mode: "patch" });
        expect(parsed.categoryCode).toBe("");
        expect(parsed.subcategory).toBe("");
    });

    it("ручная правка отмечается в manualFields", () => {
        const current = { manualFields: [], documentNumber: "", inputVatDeductible: true, taxRate: 19 };
        const fields = manualFieldsAfterPatch(current, { documentNumber: "RE-1", inputVatDeductible: false } as never);
        expect(fields).toContain("documentNumber");
        expect(fields).toContain("inputVatDeductible");
        expect(fields).not.toContain("taxRate");
    });

    it("IBAN проверяется по контрольной сумме", () => {
        expect(normalizeIban("DE89 3704 0044 0532 0130 00")).toBe("DE89370400440532013000");
        expect(() => normalizeIban("DE00 3704 0044 0532 0130 00")).toThrow(ExpenseInputError);
    });
});

describe("category catalog and DATEV export", () => {
    it("содержит не меньше 60 категорий с de/en/ru названиями", () => {
        const leaves = EXPENSE_CATEGORY_CATALOG.filter((e) => !e.isGroup);
        expect(leaves.length).toBeGreaterThanOrEqual(60);
        for (const e of leaves) {
            expect(e.nameDe.trim()).not.toBe("");
            expect(e.nameEn.trim()).not.toBe("");
            expect(e.nameRu.trim()).not.toBe("");
            expect(e.datevSkr03).toMatch(/^\d{4}$/);
            expect(e.datevSkr04).toMatch(/^\d{4}$/);
            expect([0, 7, 19]).toContain(e.vatRate);
        }
    });

    it("коды уникальны, родитель существует, группы без счёта", () => {
        const codes = new Set(EXPENSE_CATEGORY_CATALOG.map((e) => e.code));
        expect(codes.size).toBe(EXPENSE_CATEGORY_CATALOG.length);
        for (const e of EXPENSE_CATEGORY_CATALOG) {
            if (e.isGroup) {
                expect(e.parentCode).toBe("");
                expect(e.datevSkr03).toBe("");
            } else {
                expect(codes.has(e.parentCode)).toBe(true);
            }
        }
        expect(EXPENSE_CATEGORY_GROUPS.length).toBeGreaterThanOrEqual(10);
    });

    it("ключевые счета DATEV совпадают с ELSTER/DATEV-справочником", () => {
        expect(datevAccountFor(catalogEntry("miete")!, "SKR03")).toBe("4210");
        expect(datevAccountFor(catalogEntry("miete")!, "SKR04")).toBe("6310");
        expect(datevAccountFor(catalogEntry("buerobedarf")!, "SKR03")).toBe("4930");
        expect(datevAccountFor(catalogEntry("buerobedarf")!, "SKR04")).toBe("6815");
        expect(datevAccountFor(catalogEntry("hardware")!, "SKR04")).toBe("0690");
        expect(catalogDefaults("hardware", "SKR03")?.categoryCode).toBe("it");
        expect(catalogChildren("it").map((e) => e.code)).toContain("hardware");
    });

    it("экспорт содержит колонки DATEV-импорта и считает суммы", () => {
        expect(EXPENSE_EXPORT_COLUMNS).toContain("Belegdatum");
        expect(EXPENSE_EXPORT_COLUMNS).toContain("DATEV-Konto SKR03");
        expect(EXPENSE_EXPORT_COLUMNS).toContain("Vorsteuer abziehbar");
        const row = expenseExportRow(
            {
                date: "2026-10-03", documentNumber: "RE-1", vendor: "Office Depot", vendorVatId: "DE123456789", vendorIban: "",
                category: "Bürobedarf", categoryCode: "buero", subcategory: "buerobedarf", datevAccount: "4930", datevChart: "SKR03",
                amount: 100, netAmount: 100, grossAmount: 119, vatAmount: 19, taxRate: 19, inputVatDeductible: false,
                bookingKind: "Betriebsausgabe", afaYears: null, afaResidualValue: null, folder: "Belege/Buero",
                paidDate: "", reviewStatus: "AUTO", confidence: 0.9, currency: "EUR", notes: "",
            },
            EXPENSE_CATEGORY_CATALOG
        );
        expect(row[0]).toBe("2026-10-03");
        expect(row[1]).toBe("RE-1");
        expect(row[10]).toBe("4930");
        expect(row[11]).toBe("6815");
        expect(row[12]).toBe(100);
        expect(row[14]).toBe(19);
        expect(row[15]).toBe(119);
        expect(row[16]).toBe("nein");
        expect(row[23]).toBe(90);
    });

    it("legacy-расход без net/gross экспортируется из amount", () => {
        const row = expenseExportRow(
            {
                date: "2026-01-01", documentNumber: "", vendor: "Alt", vendorVatId: "", vendorIban: "",
                category: "Sonstiges", categoryCode: "", subcategory: "", datevAccount: "", datevChart: "SKR03",
                amount: 100, netAmount: 0, grossAmount: 0, vatAmount: 0, taxRate: 19, inputVatDeductible: true,
                bookingKind: "Betriebsausgabe", afaYears: null, afaResidualValue: null, folder: "",
                paidDate: "", reviewStatus: "REVIEW", confidence: 0, currency: "EUR", notes: "",
            },
            EXPENSE_CATEGORY_CATALOG
        );
        expect(row[12]).toBe(100);
        expect(row[14]).toBe(19);
        expect(row[15]).toBe(119);
    });
});
