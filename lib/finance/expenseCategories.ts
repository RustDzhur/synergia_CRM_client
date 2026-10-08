// Справочник категорий расходов: фирма ведёт свой список в Настройках бухгалтерии, а форма расхода
// предлагает его подсказками. Пока список пуст, показываются типовые категории страны — фирма может их
// изменить и сохранить. Отчёты (BWA/EÜR, книга доходов) группируют траты по этой строке, поэтому
// одинаковые по смыслу траты должны попадать в одну категорию, а не плодить «Материалы» и «материалы».
// Файл чистый (без базы) — те же функции нужны в браузере: подсказки формы и карточка настроек.

export const EXPENSE_CATEGORY_LIMIT = 40; // больше не нужно, а список в интерфейсе ещё читается
const MAX_LENGTH = 60;

export const DEFAULT_EXPENSE_CATEGORIES: Record<string, string[]> = {
	DE: [
		"Wareneinkauf", "Material", "Miete", "Nebenkosten", "Bürobedarf", "Software & Abos",
		"Reisekosten", "Fahrzeugkosten", "Werbung", "Versicherungen", "Telefon & Internet",
		"Buchhaltung & Steuern", "Löhne", "Bankgebühren", "Sonstiges",
	],
	UA: [
		"Закупівля товарів", "Матеріали", "Оренда", "Комунальні послуги", "Канцелярія", "Програми та підписки",
		"Відрядження", "Паливо та авто", "Реклама", "Страхування", "Зв'язок та інтернет",
		"Бухгалтерія та податки", "Зарплата", "Банківські комісії", "Податки і збори", "Інше",
	],
};

/** Приведение присланного списка к справочнику: обрезка пробелов и длины, без дублей (регистр не важен). */
export function parseCategories(input: unknown): string[] {
	if (!Array.isArray(input)) return [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const raw of input) {
		const name = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH);
		if (!name) continue;
		const key = name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(name);
		if (out.length >= EXPENSE_CATEGORY_LIMIT) break;
	}
	return out;
}

/** Есть ли категория в списке (сравнение без регистра и лишних пробелов). */
export const hasCategory = (list: string[], name: string) => list.some((c) => c.toLowerCase() === name.trim().toLowerCase());

/** Что показывать в подсказках: свой список фирмы, а пока он пуст — типовой набор страны. */
export function categoriesFor(market: string | null, saved?: string[] | null): string[] {
	const own = parseCategories(saved ?? []);
	if (own.length) return own;
	return DEFAULT_EXPENSE_CATEGORIES[market ?? "DE"] ?? DEFAULT_EXPENSE_CATEGORIES.DE;
}
