import Invoice from "@/models/Invoice";
import Expense from "@/models/Expense";
import { financeSettings } from "./settings";

// Украинский учёт: он устроен иначе, чем немецкий, и это не «другой перевод», а другая логика.
//
// — ФОП на єдиному податку считает доход **по оплате**: деньги пришли — доход возник, независимо от
//   того, когда выставлен рахунок. Поэтому книга доходов строится по оплаченным счетам, а не по датам
//   выставления (в немецком EÜR тоже кассовый метод, но ставки, отчётность и сроки другие).
// — ПДВ у плательщика считается по **податковим накладним**: выданным (на продажи) и полученным
//   (на покупки). Отсюда реестр, а не только итог.
// — Кроме единого налога есть военный сбор и ЄСВ — они считаются отдельно и не входят в него.
//
// Это НЕ налоговая консультация: ставки и лимиты — настройки фирмы (FinanceSettings), а перед подачей
// отчётности цифры должен проверить бухгалтер. В интерфейсе это сказано прямо.

const round = (n: number) => Math.round(n * 100) / 100;

export interface UaTaxProfile {
    legalForm: "fop" | "tov";
    group: number; // 0 — общая система
    singleRate: number; // % единого налога (для 3-й группы: 3 или 5)
    vatPayer: boolean;
    esvMonthly: number;
    militaryRate: number; // % военного сбора с дохода (3-я группа)
    militaryFixed: number; // ₴ в месяц (1, 2 и 4 группы)
    vatLimit: number;
    vatPeriod: "month" | "quarter";
}

export function uaProfile(settings: any): UaTaxProfile {
    return {
        legalForm: settings?.uaLegalForm === "tov" ? "tov" : "fop",
        group: [0, 1, 2, 3].includes(Number(settings?.uaGroup)) ? Number(settings?.uaGroup) : 3,
        singleRate: Number(settings?.uaSingleRate) === 3 ? 3 : 5,
        vatPayer: !!settings?.uaVatPayer,
        esvMonthly: Number(settings?.uaEsvMonthly) || 1760,
        militaryRate: Number.isFinite(Number(settings?.uaMilitaryRate)) ? Number(settings?.uaMilitaryRate) : 1,
        militaryFixed: Number.isFinite(Number(settings?.uaMilitaryFixed)) ? Number(settings?.uaMilitaryFixed) : 800,
        vatLimit: Number(settings?.uaVatLimit) || 1_000_000,
        vatPeriod: settings?.uaVatPeriod === "quarter" ? "quarter" : "month",
    };
}

// ── Книга обліку доходів ─────────────────────────────────────────────────────────────────────────────
// Доход ФОП на єдиному податку — это полученные деньги. Берём счета (не черновики и не отменённые)
// с оплатой в этом году: каждая оплата — строка книги; кредит-ноты уменьшают доход (возврат клиенту).
// Считаем и налоги: единый налог, военный сбор и ЄСВ — тремя отдельными строками, как в жизни.

export interface IncomeBookRow {
    date: string; // когда пришли деньги
    number: string; // номер счёта
    customer: string;
    amount: number; // получено
    note: string;
}

export interface IncomeBookQuarter {
    quarter: 1 | 2 | 3 | 4;
    rows: IncomeBookRow[];
    income: number;
    singleTax: number;
    military: number;
    esv: number; // ЄСВ за три месяца квартала
}

export interface IncomeBook {
    year: string;
    profile: UaTaxProfile;
    quarters: IncomeBookQuarter[];
    income: number;
    singleTax: number;
    military: number;
    esv: number;
    total: number; // всё вместе к уплате за год
    limitLeft: number | null; // сколько осталось до лимита группы (null — лимита нет)
    warnings: string[];
}

const GROUP_LIMIT: Record<number, number> = { 1: 1_336_000, 2: 6_672_000, 3: 9_336_000 };

export async function incomeBook(org: string, year: string): Promise<IncomeBook> {
    const settings = await financeSettings(org);
    const profile = uaProfile(settings);
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const invoices = await Invoice.find({
        org,
        kind: "invoice",
        status: { $nin: ["draft", "cancelled"] },
        paidAt: { $gte: new Date(`${from}T00:00:00.000Z`), $lte: new Date(`${to}T23:59:59.999Z`) },
    }).select("number customerName paidAt paidAmount items currency");
    const creditNotes = await Invoice.find({
        org,
        kind: "credit_note",
        status: { $nin: ["draft", "cancelled"] },
        issueDate: { $gte: from, $lte: to },
    }).select("number customerName issueDate items currency");

    const rows: IncomeBookRow[] = invoices.map((inv) => {
        const paid = Number(inv.paidAmount) || 0;
        const gross = Number(inv.totalGross ?? 0);
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
        // возвраты клиенту в этом квартале уменьшают доход
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

    const warnings: string[] = [];
    if (profile.legalForm === "tov") {
        warnings.push("Це книга доходів для ФОП. Для ТОВ дохід і податок на прибуток рахуються інакше — потрібен бухгалтер.");
    }
    if (profile.group === 0) {
        warnings.push("У фирмы общая система налогообложения: единый налог не считается, нужен учёт доходов и расходов и декларация о прибыли.");
    }
    const limit = GROUP_LIMIT[profile.group];
    if (limit && income > limit * 0.8) {
        warnings.push(`Доход за год приближается к лимиту ${profile.group}-й группы (${limit.toLocaleString("uk-UA")} ₴). При превышении ставка единого налога — 15 %.`);
    }
    if (income === 0) warnings.push("За выбранный год нет оплаченных счетов — книга пуста.");

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
        warnings,
    };
}

// ── Реєстр податкових накладних (ПДВ) ────────────────────────────────────────────────────────────────
// Выданные — счета с налогом за период (по дате выставления: налоговая накладная регистрируется
// в ЄРПН по дате возникновения обязательств), полученные — расходы с налогом. Разница и есть ПДВ
// к уплате или к возмещению. Заодно проверяем лимит 1 000 000 ₴ за 12 месяцев: за ним регистрация
// плательщиком ПДВ становится обязательной.

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
    payable: number; // >0 — доплатить, <0 — к возмещению
    turnover12m: number; // оборот за 12 месяцев — для лимита регистрации плательщиком ПДВ
    limitLeft: number;
    warnings: string[];
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

    const invoices = await Invoice.find({ org, kind: "invoice", status: { $nin: ["draft", "cancelled"] }, issueDate: { $gte: from, $lte: to } }).select("number customerName issueDate items");
    const expenses = await Expense.find({ org, date: { $gte: from, $lte: to } }).select("vendor date amount taxRate category");

    const issued: VatRegisterRow[] = invoices
        .map((inv) => {
            const t = itemsTotals(inv.items ?? []);
            const rate = t.rates.size ? Math.max(...Array.from(t.rates)) : 0;
            return { date: String(inv.issueDate ?? ""), number: String(inv.number ?? ""), counterparty: String(inv.customerName ?? ""), net: round(t.net), tax: round(t.tax), gross: round(t.net + t.tax), rate };
        })
        .filter((r) => r.tax > 0);

    const received: VatRegisterRow[] = expenses
        .filter((e) => Number(e.taxRate) > 0)
        .map((e) => {
            const gross = Number(e.amount) || 0;
            const rate = Number(e.taxRate) || 0;
            const net = round(gross / (1 + rate / 100));
            return { date: String(e.date ?? ""), number: "", counterparty: String(e.vendor ?? ""), net, tax: round(gross - net), gross: round(gross), rate };
        });

    const issuedNet = round(issued.reduce((s, r) => s + r.net, 0));
    const issuedTax = round(issued.reduce((s, r) => s + r.tax, 0));
    const receivedNet = round(received.reduce((s, r) => s + r.net, 0));
    const receivedTax = round(received.reduce((s, r) => s + r.tax, 0));

    // Оборот за 12 месяцев до конца периода — по нему определяется обязательная регистрация плательщиком ПДВ
    const yearAgo = new Date(new Date(`${to}T00:00:00.000Z`).getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const lastYear = await Invoice.find({ org, kind: "invoice", status: { $nin: ["draft", "cancelled"] }, issueDate: { $gte: yearAgo, $lte: to } }).select("items");
    const turnover12m = round(lastYear.reduce((sum, inv) => sum + itemsTotals(inv.items ?? []).net, 0));

    const warnings: string[] = [];
    if (!profile.vatPayer) {
        warnings.push("Фирма отмечена как неплательщик ПДВ: реестр показывается для сверки, но налоговые накладные не регистрируются.");
    }
    if (turnover12m > profile.vatLimit) {
        warnings.push(`Оборот за 12 месяцев (${turnover12m.toLocaleString("uk-UA")} ₴) превысил лимит ${profile.vatLimit.toLocaleString("uk-UA")} ₴ — регистрация плательщиком ПДВ обязательна.`);
    }
    if (!issued.length && !received.length) warnings.push("За период нет ни выданных, ни полученных налоговых накладных.");

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
