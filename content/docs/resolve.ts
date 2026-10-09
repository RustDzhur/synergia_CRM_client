import type { Lang } from "../i18n";
import type { DocSection } from "./types";
import { UZ } from "../uz";

export type ResolvedGroup = { id: string; title: string; steps: string[] };
export type ResolvedSection = { id: string; title: string; intro?: string; groups: ResolvedGroup[] };

type Messages = Record<string, unknown>;

export const LABEL = /\[\[([A-Za-z0-9_.]+)\]\]/g;

export function lookup(messages: Messages, path: string): string | undefined {
	let node: unknown = messages;
	for (const part of path.split(".")) {
		if (typeof node !== "object" || node === null || !(part in node)) return undefined;
		node = (node as Messages)[part];
	}
	return typeof node === "string" ? node : undefined;
}

// [[ns.key]] → **подпись из кабинета**. Жирный маркер ** превращает в выделение сам компонент страницы.
// Цены тарифов приходят отдельной картой ([[price.standard]] и т.п.): они зависят от курса и локали,
// поэтому в словарях текстов их держать нельзя. Подстановка идёт ДО разметки ** — цена не жирная.
export function fill(text: string, messages: Messages, prices?: Record<string, string>): string {
	const withPrices = prices ? text.replace(LABEL, (whole, path: string) => prices[path] ?? whole) : text;
	return withPrices.replace(LABEL, (_, path: string) => `**${lookup(messages, path) ?? path}**`);
}

// Текст для локали. Узбекский берётся из словаря UZ (content/uz.ts) по английскому исходнику,
// остальные — из Tx (en/de/ua); нет перевода — английский.
function pick(v: { en: string; de: string; ua: string }, locale: string): string {
	if (locale === "uz") return UZ[v.en] ?? v.en;
	return v[(locale as Lang) in v ? (locale as Lang) : "en"];
}

export function resolveDocs(sections: DocSection[], locale: string, messages: Messages, prices?: Record<string, string>): ResolvedSection[] {
	return sections.map((s) => ({
		id: s.id,
		title: fill(pick(s.title, locale), messages, prices),
		intro: s.intro && fill(pick(s.intro, locale), messages, prices),
		groups: s.groups.map((g, i) => ({ id: `${s.id}-${i + 1}`, title: fill(pick(g.title, locale), messages, prices), steps: g.steps.map((step) => fill(pick(step, locale), messages, prices)) })),
	}));
}
