// Общая обработка полей товара для маршрутов POST/PATCH /api/products — раньше правка карточки
// молча теряла часть полей (PATCH знал только цену и имя), поэтому правила живут в одном месте.
// Файл чистый: те же функции годятся и для проверок в браузере.

/** Прайс товара: строки «тип цены, цена, от какого количества». Пустые и нулевые цены отбрасываются:
 *  ноль в прайсе — это «не задано», а не «бесплатно» (см. priceFor в lib/finance/pricing.ts). */
export function cleanPrices(raw: unknown): Array<{ type: string; price: number; minQty: number }> {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((x: { type?: unknown; price?: unknown; minQty?: unknown }) => ({
			type: String(x?.type ?? "").trim().slice(0, 40),
			price: Math.max(0, Number(x?.price) || 0),
			minQty: Math.max(1, Math.round(Number(x?.minQty) || 1)),
		}))
		.filter((x) => x.price > 0)
		.slice(0, 20);
}

/** Картинка товара: только http(s)-ссылка (файлы не храним), до 500 знаков. Пусто — убрать картинку. */
export function cleanImage(v: unknown): string {
	return typeof v === "string" && /^https?:\/\//.test(v.trim()) ? v.trim().slice(0, 500) : "";
}

/** Штрихкод: цифры, латиница и дефис — то, что печатают на этикетках и читают сканером. */
export function cleanBarcode(v: unknown): string {
	return typeof v === "string" ? v.trim().replace(/[^0-9A-Za-z-]/g, "").slice(0, 40) : "";
}
