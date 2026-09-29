import type { Lang } from "../i18n";
import type { DocSection } from "./types";

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
export function fill(text: string, messages: Messages): string {
	return text.replace(LABEL, (_, path: string) => `**${lookup(messages, path) ?? path}**`);
}

export function resolveDocs(sections: DocSection[], locale: Lang, messages: Messages): ResolvedSection[] {
	return sections.map((s) => ({
		id: s.id,
		title: fill(s.title[locale], messages),
		intro: s.intro && fill(s.intro[locale], messages),
		groups: s.groups.map((g, i) => ({ id: `${s.id}-${i + 1}`, title: fill(g.title[locale], messages), steps: g.steps.map((step) => fill(step[locale], messages)) })),
	}));
}
