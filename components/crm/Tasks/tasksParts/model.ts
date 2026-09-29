import { localeTag } from "@/utils/dateHelpers";

export type View = "list" | "deadline" | "planner";
export type Action = "" | "done" | "active" | "delete";

// Начало суток: планировщик сравнивает задачи по календарным дням, а не по времени
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const dateText = (tag: string, iso?: string, month: "long" | "short" = "long") =>
	iso ? new Date(iso).toLocaleString(tag, { day: "numeric", month, hour: "2-digit", minute: "2-digit" }) : "";

// Как давно прошёл срок: «4 months» (единицы и язык — через Intl)
export function overdueLabel(deadline: string, locale: string): string {
	const minutes = Math.max(1, Math.floor((Date.now() - new Date(deadline).getTime()) / 60000));
	const units: Array<[Intl.NumberFormatOptions["unit"], number]> = [
		["year", 525600], ["month", 43200], ["week", 10080], ["day", 1440], ["hour", 60], ["minute", 1],
	];
	const [unit, size] = units.find(([, s]) => minutes >= s) ?? units[units.length - 1];
	return new Intl.NumberFormat(localeTag(locale), { style: "unit", unit, unitDisplay: "long" }).format(Math.floor(minutes / size));
}
