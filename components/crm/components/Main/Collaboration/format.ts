import { localeTag } from "@/app/utils/dateHelpers";

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
