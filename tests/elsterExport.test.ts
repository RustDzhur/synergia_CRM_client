// Правила выгрузки расходов для бухгалтера/ELSTER: EÜR-строки из CSV-каталога, Kleinunternehmer,
// Bewirtung 70/30, приватные и доходные записи отдельным блоком, Soll/Ist. Чистые функции —
// проверяются без базы: маршрут только выбирает строки, вся арифметика и маппинг здесь.
import { describe, expect, it } from "vitest";
import {
    ELSTER_CATEGORY_MAPPING,
    ELSTER_CRM_ALIASES,
    elsterLineAndKz,
    elsterMappingFor,
} from "@/lib/finance/elsterMapping";
import {
    buildExpenseExport,
    EXPENSE_EXPORT_COLUMNS,
    expenseExportCsv,
    expenseExportRow,
    exportTaxAmounts,
    isIncomeOrPrivate,
    PRIVAT_EXPORT_COLUMNS,
    type ExpenseExportSource,
} from "@/lib/finance/expenseExport";

const source = (patch: Partial<ExpenseExportSource> = {}): ExpenseExportSource => ({
    date: "2026-10-03",
    documentNumber: "RE-1",
    vendor: "Office Depot",
    vendorVatId: "DE123456789",
    vendorIban: "",
    category: "Bürobedarf",
    categoryCode: "buero",
    subcategory: "buerobedarf",
    datevAccount: "4930",
    datevChart: "SKR03",
    amount: 100,
    netAmount: 100,
    grossAmount: 119,
    vatAmount: 19,
    taxRate: 19,
    inputVatDeductible: true,
    bookingKind: "Betriebsausgabe",
    afaYears: null,
    afaResidualValue: null,
    folder: "Belege/Buero",
    paidDate: "2026-10-10",
    reviewStatus: "AUTO",
    confidence: 0.9,
    currency: "EUR",
    notes: "",
    ...patch,
});

const column = (name: string) => EXPENSE_EXPORT_COLUMNS.indexOf(name as never);
const cell = (row: Array<string | number>, name: string) => row[column(name)];

describe("ELSTER-Mapping aus ELSTER_CATEGORIES.csv", () => {
    it("enthält alle Kategorien des Katalogs und die CRM-Überleitung", () => {
        expect(Object.keys(ELSTER_CATEGORY_MAPPING)).toHaveLength(112);
        expect(Object.keys(ELSTER_CRM_ALIASES).length).toBeGreaterThanOrEqual(80);
        for (const target of Object.values(ELSTER_CRM_ALIASES)) {
            expect(ELSTER_CATEGORY_MAPPING[target], `alias target ${target}`).toBeTruthy();
        }
    });

    it("liefert EÜR-Zeile und Kz für Kategorien und Bewirtung mit zwei Kennzahlen", () => {
        expect(elsterMappingFor("betriebsausgaben.buero")).toMatchObject({ euerLine: "51", euerKz: "229", group: false });
        expect(elsterMappingFor("betriebsausgaben.bewirtung")).toMatchObject({ euerLine: "63", euerKz: "165/175" });
        expect(elsterMappingFor("betriebsausgaben.geschenke")).toMatchObject({ euerLine: "62", euerKz: "164/174" });
        expect(elsterMappingFor("betriebsausgaben.abschreibungen")).toMatchObject({ euerLine: "31-38" });
    });

    it("Private Kfz-Nutzung ist eine Betriebseinnahme (Zeile 20, Kz 106), Entnahme Zeile 106", () => {
        expect(elsterMappingFor("fahrzeug.privatnutzung")).toMatchObject({ euerLine: "20", euerKz: "106" });
        expect(elsterMappingFor("privatentnahme.geld")).toMatchObject({ euerLine: "106", euerKz: "122" });
    });

    it("übersetzt die abweichenden Codes des CRM-Katalogs (buerobedarf → betriebsausgaben.buero)", () => {
        expect(elsterMappingFor("buerobedarf")?.source).toBe("betriebsausgaben.buero");
        expect(elsterLineAndKz("buerobedarf")).toEqual({ line: "51", kz: "229" });
        expect(elsterLineAndKz("gibt_es_nicht")).toEqual({ line: "", kz: "" });
        expect(elsterMappingFor("gibt_es_nicht")).toBeNull();
    });

    it("CRM-Code privatentnahme gewinnt gegen die gleichnamige CSV-Gruppe (Entnahme 106)", () => {
        expect(elsterMappingFor("privatentnahme")).toMatchObject({ euerLine: "106", euerKz: "122", group: false });
    });

    it("Gruppen und private Ausgaben haben keine eigene EÜR-Zeile", () => {
        expect(elsterMappingFor("betriebsausgaben")).toMatchObject({ group: true, euerLine: "" });
        expect(elsterMappingFor("privatentnahme.ausgaben")).toMatchObject({ group: false, euerLine: "" });
    });
});

describe("Export: Kleinunternehmer §19 UStG", () => {
    it("schreibt brutto als Netto, keine USt und keinen Vorsteuerabzug", () => {
        const row = expenseExportRow(source(), [], { kleinunternehmer: true });
        expect(cell(row, "Netto")).toBe(119);
        expect(cell(row, "Brutto")).toBe(119);
        expect(cell(row, "USt-Satz")).toBe(0);
        expect(cell(row, "USt-Betrag")).toBe(0);
        expect(cell(row, "Vorsteuer abziehbar")).toBe("nein");
        expect(exportTaxAmounts(source(), { kleinunternehmer: true })).toEqual({ net: 119, vat: 0, gross: 119, rate: 0 });
    });

    it("ohne Kleinunternehmer bleibt es netto mit USt", () => {
        const row = expenseExportRow(source(), []);
        expect(cell(row, "Netto")).toBe(100);
        expect(cell(row, "USt-Satz")).toBe(19);
        expect(cell(row, "USt-Betrag")).toBe(19);
        expect(cell(row, "Vorsteuer abziehbar")).toBe("ja");
    });
});

describe("Export: Soll-/Ist-Versteuerung", () => {
    it("Zahlungsdatum wird nur bei IST gefüllt", () => {
        expect(cell(expenseExportRow(source(), [], { sollIst: "SOLL" }), "Zahlungsdatum")).toBe("");
        expect(cell(expenseExportRow(source(), [], { sollIst: "IST" }), "Zahlungsdatum")).toBe("2026-10-10");
    });
});

describe("Export: Bewirtung 70/30", () => {
    it("teilt netto in abziehbar (70 %) und nicht abziehbar (30 %)", () => {
        const row = expenseExportRow(source({ subcategory: "bewirtung", categoryCode: "reise", category: "Bewirtung" }), []);
        expect(cell(row, "EÜR-Zeile")).toBe("63");
        expect(cell(row, "EÜR-Kz")).toBe("165/175");
        expect(cell(row, "Bewirtung abziehbar (70 %)")).toBe(70);
        expect(cell(row, "Bewirtung nicht abziehbar (30 %)")).toBe(30);
    });

    it("bei Kleinunternehmer ist die Basis brutto (die USt ist nicht abziehbar)", () => {
        const row = expenseExportRow(source({ subcategory: "bewirtung", categoryCode: "reise" }), [], { kleinunternehmer: true });
        expect(cell(row, "Bewirtung abziehbar (70 %)")).toBe(83.3);
        expect(cell(row, "Bewirtung nicht abziehbar (30 %)")).toBe(35.7);
    });

    it("andere Kategorien bekommen keine 70/30-Werte", () => {
        const row = expenseExportRow(source(), []);
        expect(cell(row, "Bewirtung abziehbar (70 %)")).toBe("");
        expect(cell(row, "Bewirtung nicht abziehbar (30 %)")).toBe("");
    });
});

describe("Export: Einnahmen/Privat statt Betriebsausgaben", () => {
    it("erkennt Privatentnahme, Income und fahrzeug.privatnutzung", () => {
        expect(isIncomeOrPrivate(source({ bookingKind: "Privatentnahme" }))).toBe(true);
        expect(isIncomeOrPrivate(source({ bookingKind: "Income" }))).toBe(true);
        expect(isIncomeOrPrivate(source({ subcategory: "fahrzeug.privatnutzung", categoryCode: "fahrzeug" }))).toBe(true);
        expect(isIncomeOrPrivate(source({ categoryCode: "privat" }))).toBe(true);
        expect(isIncomeOrPrivate(source())).toBe(false);
    });

    it("private Kfz-Nutzung steht im Block Einnahmen/Privat (Zeile 20, Kz 106), nicht bei den Ausgaben", () => {
        const result = buildExpenseExport(
            [
                source(),
                source({ subcategory: "fahrzeug.privatnutzung", categoryCode: "fahrzeug", vendor: "Privat", grossAmount: 300, netAmount: 300, vatAmount: 0, taxRate: 0 }),
            ],
            []
        );
        expect(result.rows).toHaveLength(1);
        expect(result.privat.rows).toHaveLength(1);
        expect(result.summary.rows).toBe(1);
        expect(result.summary.privatRows).toBe(1);
        const privatRow = result.privat.rows[0];
        expect(privatRow[PRIVAT_EXPORT_COLUMNS.indexOf("EÜR-Zeile")]).toBe("20");
        expect(privatRow[PRIVAT_EXPORT_COLUMNS.indexOf("EÜR-Kz")]).toBe("106");
        expect(privatRow[PRIVAT_EXPORT_COLUMNS.indexOf("Betrag (Brutto)")]).toBe(300);
        // сумма расходов не включает приватную «Einnahme»
        expect(result.summary.totals.gross).toBe(119);
    });

    it("Privatentnahme landet mit Zeile 106 / Kz 122 im Privatblock", () => {
        const result = buildExpenseExport([source({ bookingKind: "Privatentnahme", subcategory: "privatentnahme", categoryCode: "privat" })], []);
        expect(result.rows).toHaveLength(0);
        const row = result.privat.rows[0];
        expect(row[PRIVAT_EXPORT_COLUMNS.indexOf("EÜR-Zeile")]).toBe("106");
        expect(row[PRIVAT_EXPORT_COLUMNS.indexOf("EÜR-Kz")]).toBe("122");
    });

    it("без приватных строк блок не добавляется в CSV", () => {
        const csv = expenseExportCsv(buildExpenseExport([source()], []));
        expect(csv).not.toContain("Einnahmen/Privat");
        const withPrivat = expenseExportCsv(buildExpenseExport([source(), source({ bookingKind: "Privatentnahme" })], []));
        expect(withPrivat).toContain("Einnahmen/Privat");
        expect(withPrivat.indexOf("Einnahmen/Privat")).toBeGreaterThan(withPrivat.indexOf("Belegdatum"));
    });
});

describe("Export: unbekannte Kategorie und Gruppen", () => {
    it("unbekannter Code → leere EÜR-Zelle und Warnung im Summary", () => {
        const result = buildExpenseExport([source({ subcategory: "gibt_es_nicht", categoryCode: "erfunden" })], []);
        const row = result.rows[0];
        expect(cell(row, "EÜR-Zeile")).toBe("");
        expect(cell(row, "EÜR-Kz")).toBe("");
        expect(result.summary.warnings).toHaveLength(1);
        expect(result.summary.warnings[0]).toContain("gibt_es_nicht");
        expect(result.summary.warnings[0]).toContain("keine EÜR-Zuordnung");
    });

    it("Gruppe ohne Unterkategorie → Warnung «Sammelgruppe»", () => {
        const result = buildExpenseExport([source({ subcategory: "", categoryCode: "buero" })], []);
        expect(cell(result.rows[0], "EÜR-Zeile")).toBe("");
        expect(result.summary.warnings).toHaveLength(1);
        expect(result.summary.warnings[0]).toContain("Sammelgruppe");
    });

    it("Warnungen werden nicht pro Zeile dupliziert", () => {
        const result = buildExpenseExport(
            [
                source({ subcategory: "gibt_es_nicht" }),
                source({ subcategory: "gibt_es_nicht", vendor: "Zweite Rechnung" }),
            ],
            []
        );
        expect(result.summary.warnings).toHaveLength(1);
    });
});

describe("Export: Summary", () => {
    it("суммирует расходы и группирует их по строкам EÜR", () => {
        const result = buildExpenseExport(
            [
                source(), // 51
                source({ subcategory: "miete", categoryCode: "raum", netAmount: 500, grossAmount: 595, vatAmount: 95 }), // 39
                source({ subcategory: "buerobedarf", categoryCode: "buero", netAmount: 50, grossAmount: 59.5, vatAmount: 9.5 }), // 51
            ],
            []
        );
        expect(result.summary.rows).toBe(3);
        expect(result.summary.totals).toEqual({ net: 650, vat: 123.5, gross: 773.5 });
        expect(result.summary.euerLines).toEqual([
            { line: "39", amount: 500 },
            { line: "51", amount: 150 },
        ]);
        expect(result.summary.warnings).toEqual([]);
        expect(result.summary.sollIst).toBe("SOLL");
        expect(result.summary.kleinunternehmer).toBe(false);
        expect(result.summary.wirtschaftsjahr).toBe(new Date().getFullYear());
    });

    it("Wirtschaftsjahr и Soll/Ist попадают в summary и имя CSV-секции не зависит от года", () => {
        const result = buildExpenseExport([source()], [], { wirtschaftsjahr: 2025, sollIst: "IST" });
        expect(result.summary.wirtschaftsjahr).toBe(2025);
        expect(result.summary.sollIst).toBe("IST");
        expect(expenseExportCsv(result)).toContain("Zahlungsdatum");
    });
});
