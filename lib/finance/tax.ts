import { defaultTaxRate } from "./taxRates";
import { marketOf } from "./market";
import { UZ_SEED, pickRule } from "./taxRulesData";

// Налоговая политика фирмы — одно место, где решается, какая ставка попадёт в документ.
// Раньше этого не было: ставку присылал браузер, сервер её сохранял как есть, а настройка
// «освобождён от НДС» превращалась в косметическую пометку — в счёте оставался налог 19 %.
// Теперь ставку всегда определяет сервер по настройкам бухгалтерии.

export interface TaxPolicySettings {
    country?: string;
    smallBusiness?: boolean;
    uaVatPayer?: boolean;
    uz?: unknown; // Json из базы: { vatPayer, taxRegime, … } (lib/validation/uz.ts)
}

const uzOf = (s: TaxPolicySettings) => ((s.uz && typeof s.uz === "object" ? s.uz : {}) as { vatPayer?: boolean; taxRegime?: string });

// Фирма не начисляет налог: в Германии — Kleinunternehmerregelung §19 UStG, в Украине — фирма,
// не зарегистрированная плательщиком ПДВ (в документе печатается «ПДВ не нараховується»).
// В Узбекистане — фирма, не отмеченная плательщиком QQS, и ИП/самозанятый (в документе печатается «QQS hisoblanmaydi»).
export const taxExempt = (s: TaxPolicySettings) => {
    const m = marketOf(s.country);
    if (m === "UA") return !s.uaVatPayer;
    if (m === "UZ") { const u = uzOf(s); return u.vatPayer !== true || u.taxRegime === "self_employed"; }
    return !!s.smallBusiness;
};

// Ставка по умолчанию для страны фирмы (0 для освобождённых и для неизвестной страны)
export const defaultRateFor = (s: TaxPolicySettings, today = new Date().toISOString().slice(0, 10)) => {
    if (marketOf(s.country) === "UZ" && !taxExempt(s)) {
        // Режим 6 % действует только с даты правила; до неё и после — общая ставка (по записям TaxRule, начальным из кода)
        const simplified = uzOf(s).taxRegime === "simplified_vat6" ? pickRule(UZ_SEED, "vat_simplified", today) : null;
        if (simplified?.exact && simplified.rule.rate != null) return simplified.rule.rate;
        return pickRule(UZ_SEED, "vat_standard", today)?.rule.rate ?? 12;
    }
    return defaultTaxRate(s.country ?? "", taxExempt(s));
};

// Приводит строки документа к налоговой политике фирмы. Вызывается на каждом создании документа,
// поэтому правило одно и то же для счёта, заказа, предложения, договора, повторяющегося счёта и кредит-ноты.
export function applyTaxPolicy<T extends { taxRate?: number | null }>(items: T[], s: TaxPolicySettings): T[] {
    if (taxExempt(s)) return items.map((i) => ({ ...i, taxRate: 0 }));
    const fallback = defaultRateFor(s);
    // ставка 0 у неосвобождённой фирмы — это либо «не заполнено» (у товара ставка не задана),
    // либо осознанный ноль (например, экспорт). Различить их в строке нельзя, поэтому
    // ноль оставляем как есть: подставлять страновую ставку поверх явного нуля опаснее.
    return items.map((i) => (i.taxRate === undefined || i.taxRate === null ? { ...i, taxRate: fallback } : i));
}
