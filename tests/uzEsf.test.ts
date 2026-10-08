import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser, ctx } from "./helpers/http";
import { esfIssues, toUzs, cleanEsfMark } from "@/lib/finance/esf";
import { cbuRowRate } from "@/lib/finance/rates";
import { GET as getEsf } from "@/app/api/finance/uz/esf/route";
import { GET as exportEsf } from "@/app/api/finance/uz/esf/export/route";
import { GET as getInvoiceEsf, PATCH as patchInvoiceEsf } from "@/app/api/invoices/[id]/esf/route";
import { PATCH as patchExpense } from "@/app/api/expenses/[id]/route";

const UZ = { inn: "301234567", vatPayer: true, vatCode: "123456789", bank: "Test Bank", mfo: "00014", account: "20208000123456789012", director: "A. Karimov", accountant: "B. Rustamova" };
const full = { number: "HF-1", kind: "invoice", issueDate: "2026-07-01", supplyDate: "2026-07-01", currency: "UZS", customerName: "Mijoz MChJ", customerTaxId: "309876543", customerAddress: "Toshkent", contract: "c1", items: [{ description: "Xizmat", unit: "dona", qty: 2, unitPrice: 1000, taxRate: 12 }] };

describe("ЭСФ: проверка полноты", () => {
    it("полный документ — без замечаний", () => {
        expect(esfIssues(full, { legalName: "Firma", address: "Toshkent" }, UZ)).toEqual([]);
    });
    it("каждое отсутствующее обязательное поле даёт свой код", () => {
        const codes = (inv: object, uz: object = UZ, seller = { legalName: "F", address: "A" }) => esfIssues({ ...full, ...inv } as never, seller, uz).map((i) => `${i.severity}:${i.code}`);
        expect(codes({ customerTaxId: "" })).toContain("error:buyer_inn");
        expect(codes({ items: [{ description: "X", qty: 1, unitPrice: 5, taxRate: 12 }] })).toContain("error:item_unit");
        expect(codes({ currency: "USD" })).toContain("error:currency_rate");
        expect(codes({ currency: "USD", rate: { value: 12500 } })).not.toContain("error:currency_rate");
        expect(codes({}, { ...UZ, vatCode: "" })).toContain("error:seller_vat_code");
        expect(codes({}, { ...UZ, vatPayer: false })).toContain("warning:seller_not_vat_payer");
        expect(codes({}, { ...UZ, mfo: "" })).toContain("error:seller_bank");
        expect(codes({ supplyDate: "" })).toContain("warning:supply_date");
        expect(codes({ contract: null, order: null })).toContain("warning:basis_document");
        expect(codes({}, {}, { legalName: "", address: "" })).toEqual(expect.arrayContaining(["error:seller_name", "error:seller_address", "error:seller_inn"]));
    });
});

describe("курс ЦБ Узбекистана и суммы в сумах", () => {
    it("строка ответа: учёт номинала и формата даты", () => {
        expect(cbuRowRate({ Ccy: "USD", Rate: "12 345.67".replace(" ", ""), Nominal: "1", Date: "08.10.2026" })).toEqual({ rate: 12345.67, at: "2026-10-08" });
        expect(cbuRowRate({ Ccy: "JPY", Rate: "85.5", Nominal: "10", Date: "08.10.2026" })?.rate).toBeCloseTo(8.55, 5);
        expect(cbuRowRate({ Ccy: "USD", Rate: "0" })).toBeNull();
        expect(cbuRowRate(undefined)).toBeNull();
    });
    it("валютный документ пересчитывается по снимку курса, без курса — null", () => {
        expect(toUzs(100, "USD", { value: 12500 })).toBe(1_250_000);
        expect(toUzs(100, "USD", null)).toBeNull();
        expect(toUzs(1234.567, "UZS")).toBe(1234.57);
    });
    it("отметка ЭСФ: неизвестный статус сбрасывается, мусор в полях чистится", () => {
        const m = cleanEsfMark({ status: "hack", number: "<b>1</b>" });
        expect(m?.status).toBe("none");
        expect(m?.number).not.toMatch(/[<>]/);
        expect(cleanEsfMark(null)).toBeNull();
    });
});

describe.skipIf(!hasDb)("ЭСФ: журналы и отметки через API", () => {
    async function uzOrg() {
        const o = await makeOrg();
        await prisma.financeSettings.create({ data: { org: o.org, country: "UZ", currency: "UZS", legalName: "Firmspace MChJ", address: "Toshkent", uz: UZ } });
        return o;
    }
    const issue = (org: string, number: string, extra: object = {}) =>
        prisma.invoice.create({ data: { org, number, kind: "invoice", customerName: "Mijoz MChJ", customerTaxId: "309876543", customerAddress: "Toshkent", currency: "UZS", issueDate: "2026-07-10", supplyDate: "2026-07-10", status: "sent", items: full.items as never, ...extra } });

    it("журнал выданных: суммы, готовность, экспорт CSV с позициями", async () => {
        const o = await uzOrg();
        const ok = await issue(o.org, "HF-1");
        await issue(o.org, "HF-2", { customerTaxId: "", items: [{ description: "Tovar", qty: 1, unitPrice: 500, taxRate: 12 }] });
        await prisma.invoice.create({ data: { org: o.org, number: "HF-3", customerName: "X", currency: "UZS", issueDate: "2026-07-11", status: "draft", items: full.items as never } });
        const req = asUser(o.userId);
        const res = await getEsf(req("/api/finance/uz/esf?kind=issued&from=2026-07-01&to=2026-07-31"));
        const body = (await res.json()).register;
        expect(body.rows.map((r: { number: string }) => r.number)).toEqual(["HF-1", "HF-2"]); // черновик не попадает
        expect(body.rows[0]).toMatchObject({ net: 2000, tax: 240, gross: 2240, errors: 0 });
        expect(body.notReady).toBe(1);
        expect(body.totals.gross).toBe(2240 + 560);
        const csv = await (await exportEsf(req("/api/finance/uz/esf/export?kind=issued&from=2026-07-01&to=2026-07-31"))).text();
        expect(csv).toContain("HF-1");
        expect(csv.split("\r\n")[0]).toContain("seller_vat_code");
        expect(ok.id).toBeTruthy();
    });

    it("отметка ЭСФ: номер обязателен для «отправлен», черновик не отмечается, чужой счёт — 404", async () => {
        const o = await uzOrg();
        const other = await uzOrg();
        const inv = await issue(o.org, "HF-10");
        const draft = await prisma.invoice.create({ data: { org: o.org, number: "HF-11", customerName: "X", currency: "UZS", issueDate: "2026-07-11", status: "draft", items: full.items as never } });
        const req = asUser(o.userId);
        expect((await patchInvoiceEsf(req(`/api/invoices/${inv.id}/esf`, "PATCH", { status: "sent" }), ctx(inv.id))).status).toBe(400);
        const ok = await patchInvoiceEsf(req(`/api/invoices/${inv.id}/esf`, "PATCH", { status: "confirmed", number: "ESF-777", operator: "Didox" }), ctx(inv.id));
        expect(ok.status).toBe(200);
        expect((await (await getInvoiceEsf(req(`/api/invoices/${inv.id}/esf`), ctx(inv.id))).json()).mark).toMatchObject({ status: "confirmed", number: "ESF-777" });
        expect((await patchInvoiceEsf(req(`/api/invoices/${draft.id}/esf`, "PATCH", { status: "prepared" }), ctx(draft.id))).status).toBe(400);
        expect((await patchInvoiceEsf(asUser(other.userId)(`/api/invoices/${inv.id}/esf`, "PATCH", { status: "prepared" }), ctx(inv.id))).status).toBe(404);
    });

    it("полученные: отметка ESF на расходе, расчёт QQS без ESF; рынок не UZ — 409", async () => {
        const o = await uzOrg();
        const e1 = await prisma.expense.create({ data: { org: o.org, vendor: "Postavshik", amount: 1000, taxRate: 12, currency: "UZS", date: "2026-07-05" } });
        await prisma.expense.create({ data: { org: o.org, vendor: "Boshqa", amount: 500, taxRate: 12, currency: "UZS", date: "2026-07-06" } });
        const req = asUser(o.userId);
        expect((await patchExpense(req(`/api/expenses/${e1.id}`, "PATCH", { esf: { number: "S-55", date: "2026-07-05", supplierInn: "300111222" } }), ctx(e1.id))).status).toBe(200);
        const reg = (await (await getEsf(req("/api/finance/uz/esf?kind=received&from=2026-07-01&to=2026-07-31"))).json()).register;
        expect(reg.rows.find((r: { vendor: string }) => r.vendor === "Postavshik")).toMatchObject({ hasEsf: true, esfNumber: "S-55", vat: 120 });
        expect(reg.totals.withoutEsfVat).toBe(60);
        // чужая фирма не может отметить чужой расход
        const stranger = await makeOrg();
        expect((await patchExpense(asUser(stranger.userId)(`/api/expenses/${e1.id}`, "PATCH", { esf: { number: "X" } }), ctx(e1.id))).status).toBe(404);
        // немецкая фирма — отказ по рынку
        const de = await makeOrg();
        await prisma.financeSettings.create({ data: { org: de.org, country: "DE" } });
        expect((await getEsf(asUser(de.userId)("/api/finance/uz/esf?kind=issued"))).status).toBe(409);
    });
});
