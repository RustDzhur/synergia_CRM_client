import { localeTag } from "@/utils/dateHelpers";

const pad = (n: number) => String(n).padStart(2, "0");
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// "June 23 18:10" — дата записи в ленте
export function formatPostDate(iso: string, locale: string): string {
	const d = new Date(iso);
	const month = d.toLocaleDateString(localeTag(locale), { month: "long" });
	return `${month} ${d.getDate()} ${hhmm(d)}`;
}

// "30 December 2018 11:15" — время последнего сообщения в списке чатов
export function formatChatDate(iso: string, locale: string): string {
	const d = new Date(iso);
	// в макете день стоит перед месяцем — для английского берём британский формат
	const tag = locale === "en" ? "en-GB" : localeTag(locale);
	return `${d.toLocaleDateString(tag, { day: "numeric", month: "long", year: "numeric" })} ${hhmm(d)}`;
}

export const initialsOf = (name: string) =>
	name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// "23.06.2026 18:10" — срок, указанный у записи ленты
export function formatDueDate(iso: string, locale: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	// как и в чатах: день перед месяцем, для английского — британский порядок
	return `${d.toLocaleDateString(locale === "en" ? "en-GB" : localeTag(locale))} ${hhmm(d)}`;
}
