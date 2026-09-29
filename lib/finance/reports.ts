import Invoice from "@/models/Invoice";
import Expense from "@/models/Expense";
import { financeSettings } from "./settings";
import { assetsSummary } from "./assets";
import Asset from "@/models/Asset";
import { costsByCategory, incomeOf, inputVatByRate, monthlySeries, salesByRate, sumGross, totalNet, totalTax } from "./reportMath";

// Отчёты для налоговой и для себя: UStVA (декларация по НДС), EÜR (доходы-расходы), BWA (анализ хозяйственной
// деятельности) и SuSa (оборотно-сальдовая ведомость). Всё считается из уже имеющихся документов — счетов,
// кредит-нот и расходов, — поэтому отдельного журнала проводок не требуется.
//
// Это НЕ налоговая консультация: суммы и номера строк (Kennzahl) соответствуют обычной практике в Германии,
// но перед подачей их должен проверить бухгалтер или налоговый консультант. В интерфейсе это сказано прямо.

export interface Money { net: number; tax: number }

export interface VatLine extends Money { rate: number }

export interface ElsterHint {
    label: string;      // что за строка
    value: number;      // сумма
    kennzahl: string;   // номер строки в ELSTER (для Германии)
    where: string;      // на каком листе и в каком поле
}

export interface VatReturn {
    from: string;
    to: string;
    country: string;
    exempt: boolean;        // Kleinunternehmer: декларация не подаётся
    sales: VatLine[];       // обороты по ставкам
    inputVat: VatLine[];    // вычет по расходам
    salesNet: number;
    salesTax: number;
    inputNet: number;
    inputTax: number;
    payable: number;        // >0 — доплатить, <0 — вернут
    elster: ElsterHint[];
    warnings: string[];     // что проверить перед подачей
}

export interface IncomeSurplus {
    from: string;
    to: string;
    income: Array<{ label: string; amount: number }>;
    expenses: Array<{ label: string; amount: number }>;
    incomeTotal: number;
    expenseTotal: number;
    profit: number;
}

export interface BwaRow { key: string; amount: number }
export interface BwaMonth { period: string; revenue: number; costs: number; profit: number }
export interface BusinessAnalysis {
    from: string;
    to: string;
    months: BwaMonth[];
    revenue: number;
    costs: number;
    profit: number;
    revenueRows: BwaRow[];
    costRows: BwaRow[];
}

export interface TrialBalanceRow { account: string; name: string; debit: number; credit: number; balance: number }
export interface TrialBalance { from: string; to: string; rows: TrialBalanceRow[]; debitTotal: number; creditTotal: number }

const round = (n: number) => Math.round(n * 100) / 100;

// ── UStVA: налог на добавленную стоимость за период ────────────────────────────────────────────────────────
// Обороты берём по дате выставления счёта (Soll-Versteuerung — обычный вариант для большинства фирм).
// Отменённые счета и черновики не учитываются: черновик ещё не документ, отменённый — не существует.
export async function vatReturn(org: string, from: string, to: string): Promise<VatReturn> {
    const settings = await financeSettings(org);
    const exempt = !!settings.smallBusiness;

    const invoices = await Invoice.find({
        org,
        kind: "invoice",
        status: { $nin: ["draft", "cancelled"] },
        issueDate: { $gte: from, $lte: to },
    }).select("items issueDate");
    const creditNotes = await Invoice.find({
        org,
        kind: "credit_note",
        status: { $nin: ["draft", "cancelled"] },
        issueDate: { $gte: from, $lte: to },
    }).select("items issueDate");
    const expenses = await Expense.find({ org, date: { $gte: from, $lte: to } }).select("amount taxRate");

    // Всю арифметику ведёт lib/finance/reportMath.ts: те же функции проверены тестом отдельно от базы.
    // Освобождённая фирма (§19) не начисляет налог ни в одной строке и не имеет права на вычет.
    const sales = salesByRate(invoices, creditNotes, exempt);
    const inputVat = inputVatByRate(expenses, exempt);
    const salesNet = totalNet(sales);
    const salesTax = totalTax(sales);
    const inputNet = totalNet(inputVat);
    const inputTax = totalTax(inputVat);
    const payable = round(salesTax - inputTax);

    // Номера строк — из бланка UStVA (Vordruck USt 1 A). Названия строк умышленно повторяют бланк,
    // чтобы бухгалтер мог сверить цифру, не пересчитывая её.
    const elster: ElsterHint[] = [];
    const at19 = sales.find((l) => l.rate === 19);
    const at7 = sales.find((l) => l.rate === 7);
    const zero = sales.filter((l) => l.rate === 0);
    const zeroNet = round(zero.reduce((s, l) => s + l.net, 0));

    if (at19) {
        elster.push({ label: "Umsätze 19 % — Bemessungsgrundlage", value: at19.net, kennzahl: "81", where: "USt 1 A, Zeile 20 (Kz 81)" });
        elster.push({ label: "Umsatzsteuer 19 %", value: at19.tax, kennzahl: "81", where: "wird aus Kz 81 berechnet — Betrag prüfen" });
    }
    if (at7) {
        elster.push({ label: "Umsätze 7 % — Bemessungsgrundlage", value: at7.net, kennzahl: "86", where: "USt 1 A, Zeile 25 (Kz 86)" });
        elster.push({ label: "Umsatzsteuer 7 %", value: at7.tax, kennzahl: "86", where: "wird aus Kz 86 berechnet — Betrag prüfen" });
    }
    if (zeroNet) {
        elster.push({ label: "Umsätze zum Nullsatz / steuerfrei", value: zeroNet, kennzahl: "43", where: "USt 1 A, Zeile 33 (Kz 43) — nur wenn steuerfrei mit Vorsteuerabzug" });
    }
    if (inputTax) {
        elster.push({ label: "Abziehbare Vorsteuerbeträge", value: inputTax, kennzahl: "66", where: "USt 1 A, Zeile 58 (Kz 66)" });
    }
    elster.push({
        label: payable >= 0 ? "Verbleibende Umsatzsteuer-Vorauszahlung" : "Umsatzsteuer-Überschuss (Erstattung)",
        value: Math.abs(payable),
        kennzahl: "83",
        where: "USt 1 A, Zeile 63 (Kz 83) — Zahllast; bei Erstattung Zeile 64 (Kz 84)",
    });

    const warnings: string[] = [];
    if (exempt) {
        warnings.push("Die Kleinunternehmerregelung (§19 UStG) ist aktiv: es wird keine Umsatzsteuer berechnet und keine UStVA abgegeben. Prüfen Sie die Umsatzgrenzen (25.000 € im Vorjahr, 100.000 € im laufenden Jahr).");
    }
    // Смешанные ставки встречаются редко и почти всегда означают ошибку в строке счёта
    const mixed = sales.filter((l) => l.net > 0 && l.rate !== 0).length > 1;
    if (mixed) warnings.push("Im Zeitraum kommen mehrere Steuersätze vor. Prüfen Sie, ob jede Position den richtigen Satz hat.");
    const foreign = await Invoice.countDocuments({ org, status: { $nin: ["draft", "cancelled"] }, issueDate: { $gte: from, $lte: to }, customerTaxId: { $ne: "" } });
    if (foreign > 0) warnings.push("Bei Rechnungen mit USt-IdNr. des Kunden kann es sich um innergemeinschaftliche Lieferungen handeln — sie gehören in einen eigenen Abschnitt der UStVA, nicht in Kz 81/86.");
    if (salesNet === 0 && inputNet === 0) warnings.push("Im gewählten Zeitraum gibt es keine Umsätze und keine Ausgaben.");

    return { from, to, country: settings.country || "", exempt, sales, inputVat, salesNet, salesTax, inputNet, inputTax, payable, elster, warnings };
}

// ── EÜR: доходы минус расходы ─────────────────────────────────────────────────────────────────────────────
// В отличие от UStVA считается по оплате (Zufluss/Abfluss), поэтому берём оплаченные счета и все расходы периода.
export async function incomeSurplus(org: string, from: string, to: string): Promise<IncomeSurplus> {
    const invoices = await Invoice.find({
        org, kind: "invoice", status: "paid",
        $or: [{ paidAt: { $gte: new Date(from), $lte: new Date(`${to}T23:59:59.999Z`) } }, { paidAt: null, issueDate: { $gte: from, $lte: to } }],
    }).select("items paidAmount currency issueDate paidAt");
    const creditNotes = await Invoice.find({
        org, kind: "credit_note", status: { $nin: ["draft", "cancelled"] },
        issueDate: { $gte: from, $lte: to },
    }).select("items");
    const expenses = await Expense.find({ org, date: { $gte: from, $lte: to } }).select("vendor category amount taxRate");

    const income = incomeOf(invoices as never, creditNotes as never);
    const cashExpenses = round(expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0));

    // Амортизация основных средств: это расход периода, но не платёж, поэтому идёт отдельной строкой,
    // а не в составе оплаченных счетов — иначе EÜR показывал бы прибыль больше реальной.
    const assets = await Asset.find({ org }).select("name category acquiredDate cost usefulLifeYears residualValue disposalDate");
    const afa = assetsSummary(assets as never, from, to).depreciation;

    const byCategory = costsByCategory(expenses as never);
    if (afa > 0) byCategory.push({ label: "Abschreibungen (AfA)", amount: afa });
    const expenseTotal = round(cashExpenses + afa);

    return {
        from, to,
        income: income ? [{ label: "Betriebseinnahmen (bezahlte Rechnungen abzüglich Gutschriften)", amount: income }] : [],
        expenses: byCategory,
        incomeTotal: income,
        expenseTotal,
        profit: round(income - expenseTotal),
    };
}

// ── BWA: выручка, затраты и результат по месяцам ──────────────────────────────────────────────────────────
export async function businessAnalysis(org: string, from: string, to: string): Promise<BusinessAnalysis> {
    const invoices = await Invoice.find({
        org, kind: "invoice", status: { $nin: ["draft", "cancelled"] },
        issueDate: { $gte: from, $lte: to },
    }).select("items issueDate");
    const creditNotes = await Invoice.find({
        org, kind: "credit_note", status: { $nin: ["draft", "cancelled"] },
        issueDate: { $gte: from, $lte: to },
    }).select("items issueDate");
    const expenses = await Expense.find({ org, date: { $gte: from, $lte: to } }).select("vendor category amount date");

    const withDate = <T,>(docs: T[], dateOf: (d: T) => string | undefined) =>
        (docs as never[]).map((d) => ({ ...(d as object), date: dateOf(d as T) })) as never[];

    const list = monthlySeries(
        withDate(invoices, (i: { issueDate?: string }) => i.issueDate),
        withDate(creditNotes, (c: { issueDate?: string }) => c.issueDate),
        expenses as never
    );
    // Амортизация попадает в тот месяц, в котором она начислена, а не в месяц покупки
    const assets = await Asset.find({ org }).select("name category acquiredDate cost usefulLifeYears residualValue disposalDate");
    const afaTotal = assetsSummary(assets as never, from, to).depreciation;

    const revenue = round(list.reduce((s, m) => s + m.revenue, 0));
    const costs = round(list.reduce((s, m) => s + m.costs, 0) + afaTotal);

    const costRows = costsByCategory(expenses as never).map((c) => ({ key: c.label, amount: c.amount }));
    if (afaTotal > 0) costRows.push({ key: "Abschreibungen (AfA)", amount: afaTotal });

    return {
        from, to,
        months: list,
        revenue, costs, profit: round(revenue - costs),
        revenueRows: [{ key: "Umsatzerlöse (netto)", amount: revenue }],
        costRows,
    };
}

// ── SuSa: оборотно-сальдовая ведомость ───────────────────────────────────────────────────────────────────
// Собственного плана счетов у системы нет, поэтому счета собираются из тех данных, что есть:
// выручка по ставкам, дебиторка по неоплаченным счетам, кредиторка по расходам и налог.
// Это управленческая, а не финансовая ведомость — для банка или аудитора её ведёт бухгалтер.
export async function trialBalance(org: string, from: string, to: string): Promise<TrialBalance> {
    const vat = await vatReturn(org, from, to);

    const openInvoices = await Invoice.find({
        org, kind: "invoice", status: { $in: ["sent", "overdue"] },
        issueDate: { $lte: to },
    }).select("items currency");
    const openSum = round(openInvoices.reduce((s, inv) => s + sumGross(inv.items as never), 0));
    const paidInvoices = await Invoice.find({ org, kind: "invoice", status: "paid", issueDate: { $gte: from, $lte: to } }).select("items");
    const paidSum = round(paidInvoices.reduce((s, inv) => s + sumGross(inv.items as never), 0));

    const rows: TrialBalanceRow[] = [];
    for (const line of vat.sales) {
        rows.push({ account: `8400`, name: `Umsatzerlöse ${line.rate} %`, debit: 0, credit: line.net, balance: round(-line.net) });
    }
    if (vat.salesTax > 0) {
        rows.push({ account: "1776", name: "Umsatzsteuer", debit: 0, credit: vat.salesTax, balance: round(-vat.salesTax) });
    }
    if (vat.inputTax > 0) {
        rows.push({ account: "1576", name: "Abziehbare Vorsteuer", debit: vat.inputTax, credit: 0, balance: vat.inputTax });
    }
    if (paidSum > 0) {
        rows.push({ account: "1200", name: "Bank (bezahlte Rechnungen)", debit: paidSum, credit: 0, balance: paidSum });
    }
    if (openSum > 0) {
        rows.push({ account: "1400", name: "Forderungen aus Lieferungen und Leistungen", debit: openSum, credit: 0, balance: openSum });
    }
    const expenseTotal = round(vat.inputNet);
    if (expenseTotal > 0) {
        rows.push({ account: "4900", name: "Sonstige betriebliche Aufwendungen", debit: expenseTotal, credit: 0, balance: expenseTotal });
    }

    const debitTotal = round(rows.reduce((s, r) => s + r.debit, 0));
    const creditTotal = round(rows.reduce((s, r) => s + r.credit, 0));
    return { from, to, rows, debitTotal, creditTotal };
}

// Границы периода лежат в reportMath (без mongoose) — их берёт и клиентский код
export { periodRange } from "./reportMath";
export type { PeriodKind } from "./reportMath";
