import { type SetStateAction, type Dispatch, useEffect } from "react";
import { defaultRateFor } from "@/lib/finance/tax";
import type { FinanceSettings, LineItem } from "@/store/useFinanceStore";

// Пустая строка документа: не жёсткий 0, а ставка фирмы по умолчанию — страна из настроек
// или 0 у фирм, освобождённых от налога (lib/finance/tax.ts).
export const emptyItem = (taxRate: number): LineItem => ({ description: "", qty: 1, unitPrice: 0, taxRate });

// Настройки бухгалтерии приходят асинхронно: их грузит раздел Finance, а документ можно открыть сразу
// по ссылке (или из карточки сделки). Пока настроек нет, первая строка остаётся с нулевым налогом,
// поэтому досеиваем её, когда настройки загрузятся.
export function useDefaultTaxRate(settings: FinanceSettings | null, setItems: Dispatch<SetStateAction<LineItem[]>>) {
	useEffect(() => {
		if (!settings) return;
		setItems((cur) => cur.map((it) => (!it.description && !it.product && !it.unitPrice ? { ...it, taxRate: defaultRateFor(settings) } : it)));
	}, [settings, setItems]);
}
