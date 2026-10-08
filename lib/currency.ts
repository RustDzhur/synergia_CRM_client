// Показ цен лендинга в местной валюте. База цен — EUR (config/plans.ts: 0 / 20 / 53 € в месяц),
// для узбекской и украинской версии сумма конвертируется по актуальному курсу, который тянется
// с интернета на сервере (app/api/currency/route.ts) и кэшируется.
//
// Заметь: это только ДИСПЛЕЙ на лендинге. Реальный расчёт, счета и налоги идут в валюте рынка
// фирмы (lib/finance/market.ts) и здесь не меняются.

export type DisplayCurrency = "EUR" | "UAH" | "UZS";

/** Валюта показа цен для локали: Германия/английский — EUR, Украина — UAH, Узбекистан — UZS. */
export const planCurrency = (locale: string): DisplayCurrency =>
	locale === "ua" ? "UAH" : locale === "uz" ? "UZS" : "EUR";

/** Приблизительные курсы на случай, когда внешний сервис недоступен (цена всё равно в местной валюте). */
export const FALLBACK_RATES: Record<string, number> = { EUR: 1, UAH: 45, UZS: 14500 };

// Округление для читаемого вида: UZS — до сотен, UAH — до десятков, EUR — без дробной части.
export function roundAmount(amount: number, currency: DisplayCurrency): number {
	if (currency === "UZS") return Math.round(amount / 1000) * 1000;
	if (currency === "UAH") return Math.round(amount / 10) * 10;
	return Math.round(amount);
}

/** Конвертирует цену в евро в валюту локали; если курса нет — возвращает цену в евро как есть. */
export function convertEur(eur: number, currency: DisplayCurrency, rates: Record<string, number> | null): number {
	if (currency === "EUR") return eur;
	const rate = rates?.[currency];
	if (!rate || !isFinite(rate)) return eur;
	return roundAmount(eur * rate, currency);
}

/** Готовая строка цены для карточки тарифа: «€20», «900 ₴», «290 000 soʻm». */
export function formatPlanPrice(eur: number, locale: string, rates: Record<string, number> | null): string {
	const currency = planCurrency(locale);
	const amount = convertEur(eur, currency, rates);
	if (currency === "EUR") return `€${amount}`;
	const tag = locale === "ua" ? "uk" : locale;
	try {
		return new Intl.NumberFormat(tag, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
	} catch {
		return currency === "UAH" ? `${amount} ₴` : `${amount} soʻm`;
	}
}
