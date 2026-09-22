import type { AdsDay } from "@/lib/ads/types";

export const money = (value: number, currency: string, locale: string) => {
	try {
		return new Intl.NumberFormat(locale, currency ? { style: "currency", currency, maximumFractionDigits: value >= 100 ? 0 : 2 } : { maximumFractionDigits: 2 }).format(value);
	} catch {
		return `${value.toFixed(2)} ${currency}`;
	}
};
export const count = (value: number, locale: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);

export function totals(days: AdsDay[]) {
	const t = days.reduce((s, d) => ({ spend: s.spend + d.spend, clicks: s.clicks + d.clicks, impressions: s.impressions + d.impressions, conversions: s.conversions + d.conversions }), { spend: 0, clicks: 0, impressions: 0, conversions: 0 });
	return { ...t, ctr: t.impressions ? (t.clicks / t.impressions) * 100 : 0, cpc: t.clicks ? t.spend / t.clicks : 0 };
}
