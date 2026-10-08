import { prisma } from "@/lib/prisma";
import { UZ_SEED, pickRule, type RuleMatch, type TaxRuleRow } from "./taxRulesData";

export { UZ_SEED, pickRule };
export type { RuleMatch, TaxRuleRow };

const fromDb = (r: { market: string; code: string; title: unknown; rate: number | null; params: unknown; validFrom: string; validTo: string | null; source: string; sourceUrl: string; note: string; verifiedBy: string | null }): TaxRuleRow => ({
    market: r.market, code: r.code, title: (r.title ?? {}) as Record<string, string>, rate: r.rate, params: (r.params ?? {}) as Record<string, unknown>,
    validFrom: r.validFrom, validTo: r.validTo, source: r.source, sourceUrl: r.sourceUrl, note: r.note, verifiedBy: r.verifiedBy,
});

const g = globalThis as { __taxRules?: { at: number; rows: TaxRuleRow[] }; __taxSeeded?: boolean };
export const resetTaxRuleCache = () => { g.__taxRules = undefined; };

/** Все правила рынка. Пока таблицы нет или она недоступна — начальные записи из кода (расчёт не ломается). */
export async function taxRules(market: string): Promise<TaxRuleRow[]> {
    let c = g.__taxRules;
    if (!c || Date.now() - c.at > 60_000) {
        let rows: TaxRuleRow[] = UZ_SEED;
        try {
            if (!g.__taxSeeded) {
                await prisma.taxRule.createMany({ data: UZ_SEED.map((r) => ({ ...r, title: r.title as never, params: r.params as never })), skipDuplicates: true });
                g.__taxSeeded = true;
            }
            const db = await prisma.taxRule.findMany({ orderBy: [{ market: "asc" }, { code: "asc" }, { validFrom: "asc" }] });
            if (db.length) rows = db.map(fromDb);
        } catch { /* таблицы нет — запасные записи из кода */ }
        c = g.__taxRules = { at: Date.now(), rows };
    }
    return c.rows.filter((r) => r.market === market);
}

export async function ruleOn(market: string, code: string, date: string): Promise<RuleMatch | null> {
    return pickRule(await taxRules(market), code, date);
}

export interface VatDecision { rate: number; ruleCode: string; exact: boolean; inputVatCredit: boolean; verified: boolean }

/** Ставка НДС Узбекистана для строки документа на дату. regime — налоговый режим фирмы; export — экспортная поставка (0 %). */
export async function uzVatOn(date: string, opts: { regime?: string; vatPayer?: boolean; exportSale?: boolean } = {}): Promise<VatDecision> {
    const rules = await taxRules("UZ");
    const pick = (code: string) => pickRule(rules, code, date);
    if (opts.vatPayer === false) return { rate: 0, ruleCode: "not_vat_payer", exact: true, inputVatCredit: false, verified: true };
    if (opts.exportSale) { const m = pick("vat_export"); if (m) return { rate: m.rule.rate ?? 0, ruleCode: "vat_export", exact: m.exact, inputVatCredit: true, verified: !!m.rule.verifiedBy }; }
    if (opts.regime === "simplified_vat6") {
        const m = pick("vat_simplified");
        if (m?.exact) return { rate: m.rule.rate ?? 6, ruleCode: "vat_simplified", exact: true, inputVatCredit: m.rule.params.inputVatCredit === true, verified: !!m.rule.verifiedBy };
    }
    const m = pick("vat_standard");
    return { rate: m?.rule.rate ?? 12, ruleCode: "vat_standard", exact: m?.exact ?? false, inputVatCredit: true, verified: !!m?.rule.verifiedBy };
}

/** Хоть одна ли запись рынка подтверждена специалистом. Нет — интерфейс показывает плашку «Бета». */
export async function marketRulesVerified(market: string): Promise<boolean> {
    const rows = await taxRules(market);
    return rows.length > 0 && rows.every((r) => !!r.verifiedBy);
}
