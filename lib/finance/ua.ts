import Invoice from "@/models/Invoice";
import Expense from "@/models/Expense";
import SupplierInvoice from "@/models/SupplierInvoice";
import { financeSettings } from "./settings";
import { groupLimit, rulesFor, rulesNotice } from "./ua/rules";
import { formAndGroup, taxSystemOf, type UaTaxSystem } from "@/lib/validation/ua";

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
    taxSystem: UaTaxSystem; // система налогообложения (ФОП 1–4, общая, ТОВ: прибуток или єдиний)
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
    // Система налогообложения — источник правды; если её ещё не выбрали, выводим из формы и группы
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

// Предупреждение отчёта: код и параметры, а не готовый текст — тексты живут в messages/*.json
// (требование R6: строки в коде не оставляем), интерфейс подставляет их переводом.
export interface ReportWarning { code: string; params?: Record<string, string | number> }

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
    /** На какой год действуют правила и откуда цифры — в интерфейсе видно «сверьтесь с бухгалтером» */
    rules: { year: number; source: string; notice: string };
    warnings: ReportWarning[];
}

export async function incomeBook(org: string, year: string): Promise<IncomeBook> {
    const settings = await financeSettings(org);
    const profile = uaProfile(settings);
    const rules = rulesFor(Number(year));
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

    const warnings: ReportWarning[] = [];
    if (profile.legalForm === "tov") warnings.push({ code: "tov_book" });
    if (profile.group === 0) warnings.push({ code: "general_system" });
    if (profile.group === 4) warnings.push({ code: "group4_area" });
    // Лимит группы — по правилам года, но фирма может задать своё значение (uaLimits) в настройках
    const limit = groupLimit(settings, Number(year), profile.group);
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
            // У расхода amount — сумма БЕЗ налога (models/Expense.ts): налог сверху, а не вычленяется из общей.
            // Раньше он считался как «из общей суммы» и занижал налоговый кредит (1000 ₴ при 20 % давали 166,67 ₴
            // вместо 200 ₴) — реестр расходился с книгой расходов
            const net = round(Number(e.amount) || 0);
            const rate = Number(e.taxRate) || 0;
            const tax = round((net * rate) / 100);
            return { date: String(e.date ?? ""), number: "", counterparty: String(e.vendor ?? ""), net, tax, gross: round(net + tax), rate };
        });

    const issuedNet = round(issued.reduce((s, r) => s + r.net, 0));
    const issuedTax = round(issued.reduce((s, r) => s + r.tax, 0));
    const receivedNet = round(received.reduce((s, r) => s + r.net, 0));
    const receivedTax = round(received.reduce((s, r) => s + r.tax, 0));

    // Оборот за 12 месяцев до конца периода — по нему определяется обязательная регистрация плательщиком ПДВ
    const yearAgo = new Date(new Date(`${to}T00:00:00.000Z`).getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const lastYear = await Invoice.find({ org, kind: "invoice", status: { $nin: ["draft", "cancelled"] }, issueDate: { $gte: yearAgo, $lte: to } }).select("items");
    const turnover12m = round(lastYear.reduce((sum, inv) => sum + itemsTotals(inv.items ?? []).net, 0));

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

// ── Податок на прибуток (ТОВ на загальній системі) ──────────────────────────────────────────────────
// У ТОВ на общей системе объект налогообложения — прибыль: доходы минус расходы и амортизация.
// Это заготовка для бухгалтера: точные суммы зависят от налоговых разниц, которые CRM не знает.

export interface ProfitReport {
    year: string;
    from: string;
    to: string;
    income: number; // доход по выставленным счетам (метод начислений — как принято у юрлиц)
    expenses: number; // расходы за период
    depreciation: number; // амортизация основных средств (если ведётся в Anlagen)
    profit: number; // прибыль до налога
    tax: number; // 18 % — справочно; фирма может переопределить в настройках отчёта
    rate: number;
    rules: { year: number; source: string; notice: string };
    warnings: ReportWarning[];
}

export async function profitReport(org: string, year: string, rate = 18): Promise<ProfitReport> {
    const settings = await financeSettings(org);
    const profile = uaProfile(settings);
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const invoices = await Invoice.find({ org, kind: "invoice", status: { $nin: ["draft", "cancelled"] }, issueDate: { $gte: from, $lte: to } }).select("items");
    const expenses = await Expense.find({ org, date: { $gte: from, $lte: to } }).select("amount");
    // Закупівлі: счета поставщиков — расход года, как и обычные расходы (по дате счёта). Без них
    // прибыль до налога была завышена на всю закупочную стоимость товара
    const purchases = await SupplierInvoice.find({ org, status: { $ne: "cancelled" }, date: { $gte: from, $lte: to } }).select("amount");
    const income = round(invoices.reduce((sum, inv) => sum + itemsTotals(inv.items ?? []).net, 0));
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
        const { default: Asset } = await import("@/models/Asset");
        const { depreciationInRange } = await import("./assets");
        const assets = await Asset.find({ org });
        return assets.reduce(
            (sum, a) => sum + depreciationInRange(a as never, `${year}-01-01`, `${year}-12-31`),
            0
        );
    } catch {
        return 0;
    }
}
