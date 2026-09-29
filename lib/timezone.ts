import User from "@/models/User";

// Часовой пояс пользователя. В профиле это свободное текстовое поле, поэтому доверяем только числу
// минут от UTC (так же его читает подключение iCloud-календаря); «Europe/Berlin» и прочие названия
// игнорируем — молча подставить чужой пояс хуже, чем честно сказать «не знаю».
const LIMIT = 840; // ±14 часов — предел реальных поясов

export function tzOffsetOf(value: unknown): number | null {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.max(-LIMIT, Math.min(LIMIT, Math.round(n)));
}

// Пояс пользователя по его профилю; если он не заполнен числом — null, и вызывающий решает,
// что взять вместо него (обычно сдвиг того, кто в этот момент работает в кабинете)
export async function tzOffsetOfUser(userId: string): Promise<number | null> {
    const user = await User.findById(userId).select("timezone").lean<{ timezone?: string }>().catch(() => null);
    return tzOffsetOf(user?.timezone);
}

// «Настенные» минуты суток для момента времени в поясе со сдвигом offsetMinutes.
// Так же считает время событий календаря (lib/calendar/reminders.ts): время события хранится
// местным, а сравнивать его надо с местным «сейчас».
export function minutesOfDay(now: Date, offsetMinutes: number): number {
    const local = new Date(now.getTime() + offsetMinutes * 60_000);
    return local.getUTCHours() * 60 + local.getUTCMinutes();
}
