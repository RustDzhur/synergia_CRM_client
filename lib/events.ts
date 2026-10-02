import type { AuthContext } from "@/lib/auth";

// Правила событий календаря, общие для маршрутов /api/events: кто что видит и как проверяются поля.
// Событие хранит местное время пользователя без часового пояса ("YYYY-MM-DD" и "HH:mm") — так же, как
// срок задачи (Task.deadline): браузер и форма показывают ровно то, что записано.
export const EVENT_CALENDARS = ["my", "company"] as const;
export const EVENT_SOURCES = ["local", "google", "icloud"] as const;

export const EVENT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// часы 00–23 и минуты 00–59: «25:99» — уже не время
export const EVENT_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// «my» — личное событие автора: видит только он; «company» — общее, видит вся фирма.
export function visibleEvents(user: AuthContext) {
    return { org: user.id, OR: [{ calendar: "company" }, { calendar: "my", createdBy: user.userId }] };
}

// Поля события из тела запроса: строки обрезаются по длине, даты и время принимаются только по шаблону.
export const eventText = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const eventDay = (v: unknown, fallback = "") => (typeof v === "string" && EVENT_DATE_RE.test(v) ? v : fallback);
export const eventTime = (v: unknown, fallback = "") => (typeof v === "string" && EVENT_TIME_RE.test(v) ? v : fallback);
export const eventMinutes = (v: unknown) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 && n <= 7 * 24 * 60 ? n : 0;
};

// Сдвиг часового пояса браузера от UTC в минутах — приходит заголовком X-Tz-Offset (app/store/crmApi.ts).
// Хранится вместе с событием: время события «настенное», и без пояса сервер не знает, когда наступает
// напоминание. Ограничение ±14 часов отсекает мусор в заголовке.
export function tzOffsetOf(req: Request): number {
    const raw = Number(req.headers.get("x-tz-offset"));
    return Number.isFinite(raw) ? Math.max(-840, Math.min(840, Math.round(raw))) : 0;
}

// Имя часового пояса браузера («Europe/Berlin») — заголовок X-Tz-Name. Нужно для записи в Google:
// сдвиг в минутах верен только сегодня, а событие может стоять на дату в другом сезоне, когда
// в том же поясе действует летнее или зимнее время (см. lib/google/calendar.ts).
export const EVENT_TZ_RE = /^[A-Za-z][A-Za-z0-9_+-]{0,40}(\/[A-Za-z0-9_+-]{1,40}){0,2}$/;

export function tzNameOf(req: Request): string {
    const raw = (req.headers.get("x-tz-name") ?? "").trim();
    return EVENT_TZ_RE.test(raw) ? raw : "";
}

// Сдвиг даты «YYYY-MM-DD» на дни. Живёт здесь, потому что нужен и календарям провайдеров, и разбору
// iCalendar: у обоих конец события «на весь день» исключающий, и пересчёт должен быть один и тот же.
export function shiftDay(day: string, delta: number): string {
    const d = new Date(`${day}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return day;
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
}
