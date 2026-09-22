import type { LineItem } from "@/app/store/useFinanceStore";

// Та же формула, что и на сервере (lib/finance/totals.ts) — только для мгновенного пересчёта в форме, пока не сохранили;
// итог, который останется в базе, всё равно считает сервер.
export function computeTotals(items: LineItem[]) {
	let net = 0;
	let tax = 0;
	for (const it of items) {
		const line = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
		net += line;
		tax += line * ((Number(it.taxRate) || 0) / 100);
	}
	const round = (n: number) => Math.round(n * 100) / 100;
	return { net: round(net), tax: round(tax), gross: round(net + tax) };
}

export const money = (value: number, currency: string, locale: string) => {
	try {
		return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
	} catch {
		return `${value.toFixed(2)} ${currency}`;
	}
};
