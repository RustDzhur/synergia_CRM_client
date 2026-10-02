import { prisma } from "@/lib/prisma";
import { financeSettings } from "./settings";
import { groupLimit, rulesFor, rulesNotice } from "./ua/rules";
import { formAndGroup, taxSystemOf, type UaTaxSystem } from "@/lib/validation/ua";
import { depreciationInRange } from "./assets";

// Украинский учёт: он устроен иначе, чем немецкий, и это не «другой перевод», а другая логика.

const round = (n: number) => Math.round(n * 100) / 100;

export interface UaTaxProfile {
    taxSystem: UaTaxSystem;
    legalForm: "fop" | "tov";
    group: number;
    singleRate: number;
    vatPayer: boolean;
    esvMonthly: number;
    militaryRate: number;
    militaryFixed: number;
    vatLimit: number;
    vatPeriod: "month" | "quarter";
}

export function uaProfile(settings: any): UaTaxProfile {
    const taxSystem = taxSystemOf(settings ?? {});
    const { legalForm, group } = formAndGroup(taxSystem, Number(settings?.uaSingleRate) === 3 ? 3 : 5);
    return {
        taxSystem,
        legalForm: legalForm === "tov" ? "tov" : "fop",
        group,
        singleRate: Number(settings?.uaSingleRate) === 3 ? 3 : 5,
        vatPayer: !!settings?.uaVatPayer,
        esvMonthly: Number(settings?.uaEsvMonthly) || 1760,
        militaryRate: Number.isFinite(Number(settings?.uaMilitaryRate)) ? Number(settings?.uaMilitaryRate) : 1,
        militaryFixed: Number.isFinite(Number(settings?.uaMilitaryFixed)) ? Number(settings?.uaMilitaryFixed) : 800,
        vatLimit: Number(settings?.uaVatLimit) || 1_000_000,
        vatPeriod: settings?.uaVatPeriod === "quarter" ? "quarter" : "month",
    };
}

export interface IncomeBookRow {
    date: string;
    number: string;
    customer: string;
    amount: number;
    note: string;
}

export interface IncomeBookQuarter {
    quarter: 1 | 2 | 3 | 4;
    rows: IncomeBookRow[];
    income: number;
    singleTax: number;
    military: number;
    esv: number;
}

export interface ReportWarning { code: string; params?: Record<string, string | number> }

export interface IncomeBook {
    year: string;
    profile: UaTaxProfile;
    quarters: IncomeBookQuarter[];
    income: number;
    singleTax: number;
    military: number;
    esv: number;
    total: number;
    limitLeft: number | null;
    rules: { year: number; source: string; notice: string };
    warnings: ReportWarning[];
}

export async function incomeBook(org: string, year: string): Promise<IncomeBook> {
    const settings = await financeSettings(org);
    const profile = uaProfile(settings);
    const rules = rulesFor(Number(year));
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const invoices = await prisma.invoice.findMany({
        where: { org, kind: "invoice", status: { notIn: ["draft", "cancelled"] }, paidAt: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) } },
        select: { number: true, customerName: true, paidAt: true, paidAmount: true, items: true, currency: true },
    });
    const creditNotes = await prisma.invoice.findMany({
        where: { org, kind: "credit_note", status: { notIn: ["draft", "cancelled"] }, issueDate: { gte: from, lte: to } },
        select: { number: true, customerName: true, issueDate: true, items: true, currency: true },
    });

    const rows: IncomeBookRow[] = invoices.map((inv) => {
        const paid = Number(inv.paidAmount) || 0;
        const gross = Number((inv as any).totalGross ?? 0);
        return {
            date: (inv.paidAt as Date).toISOString().slice(0, 10),
            number: String(inv.number ?? ""),
            customer: String(inv.customerName ?? ""),
            // если оплата частичная — в книгу идёт фактически полученное
            amount: paid || gross,
            note: "",
        };
    });

    const quarters: IncomeBookQuarter[] = ([1, 2, 3, 4] as const).map((quarter) => {
        const months = [quarter * 3 - 2, quarter * 3 - 1, quarter * 3];
        const own = rows.filter((r) => months.includes(Number(r.date.slice(5, 7)))).sort((a, b) => (a.date < b.date ? -1 : 1));
        const refunds = creditNotes
            .filter((c) => months.includes(Number(String(c.issueDate).slice(5, 7))))
            .reduce((sum, c) => sum + Number((c as unknown as { totalGross?: number }).totalGross ?? 0), 0);
        const income = round(own.reduce((s, r) => s + r.amount, 0) - refunds);
        const singleTax = round(income * (profile.singleRate / 100));
        const military = profile.group === 3
            ? round(income * (profile.militaryRate / 100))
            : round(profile.militaryFixed * 3);
        return { quarter, rows: own, income, singleTax, military, esv: round(profile.esvMonthly * 3) };
    });

    const income = round(quarters.reduce((s, q) => s + q.income, 0));
    const singleTax = round(quarters.reduce((s, q) => s + q.singleTax, 0));
    const military = round(quarters.reduce((s, q) => s + q.military, 0));
    const esv = round(quarters.reduce((s, q) => s + q.esv, 0));

    const warnings: ReportWarning[] = [];
    if (profile.legalForm === "tov") warnings.push({ code: "tov_book" });
    if (profile.group === 0) warnings.push({ code: "general_system" });
    if (profile.group === 4) warnings.push({ code: "group4_area" });
    const limit = groupLimit(settings as any, Number(year), profile.group);
    if (limit && income > limit * 0.8) {
        warnings.push({ code: "limit_near", params: { limit, group: profile.group, rate: rules.overLimitRate } });
    }
    if (income === 0) warnings.push({ code: "empty_year" });

    return {
        year,
        profile,
        quarters,
        income,
        singleTax,
        military,
        esv,
        total: round(singleTax + military + esv),
        limitLeft: limit ? round(limit - income) : null,
        rules: { year: rules.year, source: rules.source, notice: rulesNotice(Number(year)) },
        warnings,
    };
}

export interface VatRegisterRow {
    date: string;
    number: string;
    counterparty: string;
    net: number;
    tax: number;
    gross: number;
    rate: number;
}

export interface VatRegister {
    from: string;
    to: string;
    profile: UaTaxProfile;
    issued: VatRegisterRow[];
    received: VatRegisterRow[];
    issuedNet: number;
    issuedTax: number;
    receivedNet: number;
    receivedTax: number;
    payable: number;
    turnover12m: number;
    limitLeft: number;
    warnings: ReportWarning[];
}

const itemsTotals = (items: { qty?: number; unitPrice?: number; taxRate?: number }[] = []) =>
    items.reduce(
        (acc, it) => {
            const net = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
            const rate = Number(it.taxRate) || 0;
            acc.net += net;
            acc.tax += net * (rate / 100);
            if (rate) acc.rates.add(rate);
            return acc;
        },
        { net: 0, tax: 0, rates: new Set<number>() }
    );

export async function vatRegister(org: string, from: string, to: string): Promise<VatRegister> {
    const settings = await financeSettings(org);
    const profile = uaProfile(settings);

    const invoices = await prisma.invoice.findMany({ where: { org, kind: "invoice", status: { notIn: ["draft", "cancelled"] }, issueDate: { gte: from, lte: to } }, select: { number: true, customerName: true, issueDate: true, items: true } });
    const expenses = await prisma.expense.findMany({ where: { org, date: { gte: from, lte: to } }, select: { vendor: true, date: true, amount: true, taxRate: true, category: true } });

    const issued: VatRegisterRow[] = invoices
        .map((inv) => {
            const t = itemsTotals((inv.items as any) ?? []);
            const rate = t.rates.size ? Math.max(...Array.from(t.rates)) : 0;
            return { date: String(inv.issueDate ?? ""), number: String(inv.number ?? ""), counterparty: String(inv.customerName ?? ""), net: round(t.net), tax: round(t.tax), gross: round(t.net + t.tax), rate };
        })
        .filter((r) => r.tax > 0);

    const received: VatRegisterRow[] = expenses
        .filter((e) => Number(e.taxRate) > 0)
        .map((e) => {
            const net = round(Number(e.amount) || 0);
            const rate = Number(e.taxRate) || 0;
            const tax = round((net * rate) / 100);
            return { date: String(e.date ?? ""), number: "", counterparty: String(e.vendor ?? ""), net, tax, gross: round(net + tax), rate };
        });

    const issuedNet = round(issued.reduce((s, r) => s + r.net, 0));
    const issuedTax = round(issued.reduce((s, r) => s + r.tax, 0));
    const receivedNet = round(received.reduce((s, r) => s + r.net, 0));
    const receivedTax = round(received.reduce((s, r) => s + r.tax, 0));

    const yearAgo = new Date(new Date(`${to}T00:00:00.000Z`).getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const lastYear = await prisma.invoice.findMany({ where: { org, kind: "invoice", status: { notIn: ["draft", "cancelled"] }, issueDate: { gte: yearAgo, lte: to } }, select: { items: true } });
    const turnover12m = round(lastYear.reduce((sum, inv) => sum + itemsTotals((inv.items as any) ?? []).net, 0));

    const warnings: ReportWarning[] = [];
    if (!profile.vatPayer) warnings.push({ code: "not_vat_payer" });
    if (turnover12m > profile.vatLimit) warnings.push({ code: "turnover_over_limit", params: { turnover: turnover12m, limit: profile.vatLimit } });
    if (!issued.length && !received.length) warnings.push({ code: "empty_period" });

    return {
        from,
        to,
        profile,
        issued,
        received,
        issuedNet,
        issuedTax,
        receivedNet,
        receivedTax,
        payable: round(issuedTax - receivedTax),
        turnover12m,
        limitLeft: round(profile.vatLimit - turnover12m),
        warnings,
    };
}

export interface ProfitReport {
    year: string;
    from: string;
    to: string;
    income: number;
    expenses: number;
    depreciation: number;
    profit: number;
    tax: number;
    rate: number;
    rules: { year: number; source: string; notice: string };
    warnings: ReportWarning[];
}

export async function profitReport(org: string, year: string, rate = 18): Promise<ProfitReport> {
    const settings = await financeSettings(org);
    const profile = uaProfile(settings);
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const invoices = await prisma.invoice.findMany({ where: { org, kind: "invoice", status: { notIn: ["draft", "cancelled"] }, issueDate: { gte: from, lte: to } }, select: { items: true } });
    const expenses = await prisma.expense.findMany({ where: { org, date: { gte: from, lte: to } }, select: { amount: true } });
    const purchases = await prisma.supplierInvoice.findMany({ where: { org, status: { not: "cancelled" }, date: { gte: from, lte: to } }, select: { amount: true } });
    const income = round(invoices.reduce((sum, inv) => sum + itemsTotals((inv.items as any) ?? []).net, 0));
    const costs = round(
        expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) +
        purchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    );
    const depreciation = round(await depreciationInYear(org, Number(year)));
    const profit = round(income - costs - depreciation);
    const tax = profit > 0 ? round(profit * (rate / 100)) : 0;

    const warnings: ReportWarning[] = [];
    if (profile.legalForm !== "tov" || profile.taxSystem !== "general_tov") warnings.push({ code: "not_general_tov" });
    warnings.push({ code: "tax_differences" });

    const rules = rulesFor(Number(year));
    return { year, from, to, income, expenses: costs, depreciation, profit, tax, rate, rules: { year: rules.year, source: rules.source, notice: rulesNotice(Number(year)) }, warnings };
}

// Амортизация за год — из основного средства (Anlagen), если оно ведётся: у ТОВ она уменьшает прибыль
async function depreciationInYear(org: string, year: number): Promise<number> {
    try {
        const assets = await prisma.asset.findMany({ where: { org } });
        return assets.reduce(
            (sum, a) => sum + depreciationInRange(a as never, `${year}-01-01`, `${year}-12-31`),
            0
        );
    } catch {
        return 0;
    }
}
