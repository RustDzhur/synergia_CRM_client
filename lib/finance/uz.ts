import { prisma } from "@/lib/prisma";
import { financeSettings } from "./settings";
import { inputVatByRate, salesByRate, totalNet, totalTax } from "./reportMath";
import { taxRules, pickRule, type TaxRuleRow } from "./taxRules";
import type { UzProfile } from "@/lib/validation/uz";
import type { VatLine } from "./reports";

// QQS (НДС) Узбекистана за период. Считается из выданных счетов, корректировок и расходов — как немецкая UStVA, но:
//  • режим фирмы (общий порядок / упрощённый 6 % / не плательщик) определяет, можно ли вычесть входной налог;
//  • ставки сверяются с правилом TaxRule на дату документа, расхождения выводятся предупреждением (счёт не меняем);
//  • отчёт не подаётся из системы: он готовит данные для кабинета налогоплательщика.
// Предупреждения — коды; тексты в messages/*.json под ключами uzWarn_*.

export interface UzWarning { code: string; params?: Record<string, string | number> }

export interface UzVatReport {
    from: string; to: string;
    regime: string; vatPayer: boolean;
    sales: VatLine[]; inputVat: VatLine[];
    salesNet: number; salesTax: number; inputNet: number; inputTax: number;
    /** вычет входного налога разрешён режимом (при упрощённом 6 % — нет) */
    inputCreditAllowed: boolean;
    payable: number;
    rulesVerified: boolean;
    warnings: UzWarning[];
}

const round = (n: number) => Math.round(n * 100) / 100;

interface Doc { items?: Array<{ qty: number; unitPrice: number; taxRate?: number }>; issueDate?: string }

/** Чистая часть расчёта: правила и документы приходят готовыми, поэтому её проверяет тест без базы. */
export function buildUzVat(input: { from: string; to: string; invoices: Doc[]; creditNotes: Doc[]; expenses: Array<{ amount: number; taxRate: number }>; profile: Partial<UzProfile>; rules: TaxRuleRow[] }): UzVatReport {
    const { from, to, profile, rules } = input;
    // как и lib/finance/tax.ts: плательщиком фирма считается только когда это отмечено явно
    const vatPayer = profile.vatPayer === true && profile.taxRegime !== "self_employed";
    const regime = profile.taxRegime || "general";
    const exempt = !vatPayer;
    const sales = salesByRate(input.invoices as never, input.creditNotes as never, exempt);
    const gross = regime === "simplified_vat6" ? false : true;
    const inputVat = inputVatByRate(input.expenses as never, exempt);
    const salesTax = totalTax(sales);
    const inputTax = gross ? totalTax(inputVat) : 0;
    const warnings: UzWarning[] = [];

    const std = pickRule(rules, "vat_standard", to);
    const simp = pickRule(rules, "vat_simplified", to);
    if (rules.length && rules.some((r) => !r.verifiedBy)) warnings.push({ code: "rules_unverified" });
    if (std && !std.exact) warnings.push({ code: "rule_out_of_range", params: { date: to } });
    if (regime === "simplified_vat6" && !(simp?.exact)) warnings.push({ code: "simplified_not_in_force", params: { date: to } });
    if (regime === "simplified_vat6") warnings.push({ code: "simplified_no_input_credit" });
    // строки со ставкой, которой нет у режима на дату документа: счёт не трогаем, бухгалтеру показываем
    const expectedRate = regime === "simplified_vat6" && simp?.exact ? simp.rule.rate : std?.rule.rate;
    if (vatPayer && expectedRate != null) {
        const odd = new Set<number>();
        for (const d of [...input.invoices, ...input.creditNotes]) for (const it of d.items ?? []) { const r = Number(it.taxRate) || 0; if (r !== 0 && r !== expectedRate) odd.add(r); }
        if (odd.size) warnings.push({ code: "rate_mismatch", params: { rates: Array.from(odd).sort((a, b) => a - b).join(", "), expected: expectedRate } });
    }
    if (!vatPayer) warnings.push({ code: "not_vat_payer" });
    if (vatPayer && !profile.vatCode) warnings.push({ code: "vat_code_missing" });

    return {
        from, to, regime, vatPayer, sales, inputVat,
        salesNet: totalNet(sales), salesTax, inputNet: totalNet(inputVat), inputTax,
        inputCreditAllowed: gross, payable: round(salesTax - inputTax),
        rulesVerified: rules.length > 0 && rules.every((r) => !!r.verifiedBy), warnings,
    };
}

export async function uzVatReport(org: string, from: string, to: string): Promise<UzVatReport> {
    const settings = await financeSettings(org);
    const profile = ((settings as { uz?: unknown }).uz ?? {}) as Partial<UzProfile>;
    const [invoices, creditNotes, expenses, rules] = await Promise.all([
        prisma.invoice.findMany({ where: { org, kind: "invoice", status: { notIn: ["draft", "cancelled"] }, issueDate: { gte: from, lte: to } }, select: { items: true, issueDate: true } }),
        prisma.invoice.findMany({ where: { org, kind: "credit_note", status: { notIn: ["draft", "cancelled"] }, issueDate: { gte: from, lte: to } }, select: { items: true, issueDate: true } }),
        prisma.expense.findMany({ where: { org, date: { gte: from, lte: to } }, select: { amount: true, taxRate: true } }),
        taxRules("UZ"),
    ]);
    return buildUzVat({ from, to, invoices: invoices as never, creditNotes: creditNotes as never, expenses: expenses as never, profile, rules });
}
