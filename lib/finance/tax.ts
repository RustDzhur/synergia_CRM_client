import { defaultTaxRate } from "./taxRates";

// Налоговая политика фирмы — одно место, где решается, какая ставка попадёт в документ.
// Раньше этого не было: ставку присылал браузер, сервер её сохранял как есть, а настройка
// «освобождён от НДС» превращалась в косметическую пометку — в счёте оставался налог 19 %.
// Теперь ставку всегда определяет сервер по настройкам бухгалтерии.

export interface TaxPolicySettings {
    country?: string;
    smallBusiness?: boolean;
}

// Фирма на упрощённом режиме (Kleinunternehmerregelung §19 UStG и аналоги в других странах):
// налог не начисляется ни в одной строке документа.
export const taxExempt = (s: TaxPolicySettings) => !!s.smallBusiness;

// Ставка по умолчанию для страны фирмы (0 для освобождённых и для неизвестной страны)
export const defaultRateFor = (s: TaxPolicySettings) => defaultTaxRate(s.country ?? "", !!s.smallBusiness);

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
