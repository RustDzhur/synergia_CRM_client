// Даты в локальном времени: ключ дня "YYYY-MM-DD" и простые операции над ним.

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDayKey(key: string): Date {
	const [y, m, d] = key.split("-").map(Number);
	return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

// Неделя начинается с воскресенья — как в макете (Sun 23, Mon 24 ...)
export function startOfWeek(date: Date): Date {
	return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -date.getDay());
}

export function localeTag(locale: string): string {
	return locale === "ua" ? "uk" : locale;
}
