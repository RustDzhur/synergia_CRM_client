// Форматирование для таблиц и карточек CRM.

// Процент заполненности: сколько из перечисленных полей непустые. Колонка «Percent» в таблицах.
export function completeness(values: Array<string | undefined | null>): number {
    if (values.length === 0) return 0;
    const filled = values.filter((v) => typeof v === "string" && v.trim() !== "").length;
    return Math.round((filled / values.length) * 100);
}

// «1 day ago» / «yesterday» на текущем языке; меньше минуты — justNow.
export function relativeTime(iso: string | undefined, locale: string, justNow: string): string {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const seconds = Math.round(diff / 1000);
    if (seconds < 60) return justNow;
    const rtf = new Intl.RelativeTimeFormat(locale === "ua" ? "uk" : locale, { numeric: "auto" });
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
        ["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60],
    ];
    for (const [unit, size] of units) {
        if (seconds >= size) return rtf.format(-Math.floor(seconds / size), unit);
    }
    return justNow;
}

// "2023-07-23" -> "23.07.2023" (формат из макета)
export function formatDate(value: string | undefined): string {
    if (!value) return "";
    const [y, m, d] = value.split("-");
    return y && m && d ? `${d}.${m}.${y}` : value;
}

// Время записи ленты: "01:30" (как в макете)
export function formatTime(iso: string, locale: string): string {
    return new Date(iso).toLocaleTimeString(locale === "ua" ? "uk" : locale, { hour: "2-digit", minute: "2-digit" });
}

// "19 July, 09:00" — для запланированной активности
export function formatDateTime(value: string, locale: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(locale === "ua" ? "uk" : locale, {
        day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    });
}
