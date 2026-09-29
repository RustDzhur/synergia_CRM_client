import Event from "@/models/Event";
import { EVENT_DATE_RE, EVENT_TIME_RE, eventText } from "@/lib/events";

// Общий слой для внешних календарей (Google, iCloud): провайдер приводит свои события к виду
// ExternalEvent, а запись в базу, обновление и удаление делает этот файл — чтобы оба провайдера
// не расходились в поведении. Запись в сам календарь провайдера живёт в его модуле (lib/google/calendar.ts).

export type CalendarSourceKey = "google" | "icloud";

export interface ExternalEvent {
    externalId: string; // id события у провайдера: по нему повторная синхронизация не создаёт дубль
    calendarId?: string; // календарь провайдера, из которого событие приехало
    title: string;
    description?: string;
    location?: string;
    date: string; // "YYYY-MM-DD"
    startTime: string; // "HH:mm"
    endDate: string;
    endTime: string;
    // Сдвиг пояса самого события. У провайдера время приходит с поясом, и без него событие,
    // отправленное обратно, уехало бы на часы: правка из другого пояса ушла бы с чужим сдвигом.
    tzOffset?: number;
    color?: string;
}

export interface CalendarSource {
    key: CalendarSourceKey;
    connected: (org: string) => Promise<boolean>;
    fetch: (org: string, from: string, to: string) => Promise<ExternalEvent[]>;
}

// Цвет импортированных событий: свой у каждого источника, чтобы в календаре сразу было видно,
// откуда событие пришло
export const SOURCE_COLORS: Record<CalendarSourceKey, string> = {
    google: "#34A2E8",
    icloud: "#8A8FF5",
};

// Записывает события провайдера в общий календарь фирмы.
// Идемпотентно: событие ищется по (org, source, externalId); найденное обновляется,
// отсутствующее в новой выдаче — удаляется (в Google событие перенесли или отменили).
export async function upsertExternalEvents(
    org: string,
    source: CalendarSourceKey,
    events: ExternalEvent[],
    from: string,
    to: string,
    calendars: string[] = []
): Promise<{ created: number; updated: number; removed: number }> {
    const seen = new Set<string>();
    let created = 0;
    let updated = 0;

    for (const e of events) {
        if (!e.externalId || !EVENT_DATE_RE.test(e.date)) continue;
        seen.add(e.externalId);
        // Цвет и календарь ставим только у нового события: у события, созданного в CRM, они уже выбраны
        // человеком, и провайдер не должен их перебивать (личное событие иначе стало бы общим).
        const fields = {
            title: eventText(e.title, 200) || "(ohne Titel)",
            description: eventText(e.description, 2000),
            location: eventText(e.location, 300),
            date: e.date,
            startTime: EVENT_TIME_RE.test(e.startTime) ? e.startTime : "00:00",
            endDate: EVENT_DATE_RE.test(e.endDate) ? e.endDate : e.date,
            endTime: EVENT_TIME_RE.test(e.endTime) ? e.endTime : e.startTime,
            externalCalendarId: e.calendarId ?? "",
            // Пояс обновляем, только когда провайдер его сообщил: у события, созданного в CRM,
            // он выставлен автором, и терять его нельзя
            ...(Number.isFinite(e.tzOffset) ? { tzOffset: e.tzOffset } : {}),
        };
        const fresh = {
            color: e.color && /^#[0-9a-f]{6}$/i.test(e.color) ? e.color : SOURCE_COLORS[source],
            calendar: "company" as const,
            source,
            externalId: e.externalId,
        };
        const res = await Event.updateOne({ org, source, externalId: e.externalId }, { $set: fields, $setOnInsert: fresh }, { upsert: true });
        if (res.upsertedCount) created++;
        else if (res.modifiedCount) updated++;
    }

    // Удаляем только те события источника, что попадают в синхронизированное окно, исчезли у провайдера
    // и приходили из календаря, который мы в этот раз обошли. События за пределами окна мы просто
    // не запрашивали, а события из выключенного календаря не удаляем: человек отключил обновление,
    // а не сами события.
    // «"", null» в списке — события без известного календаря: строки, записанные до появления этого поля,
    // и присланные клиентом с source провайдера, но без календаря. Для них правило то же, что и раньше:
    // не пришло от провайдера — убираем, иначе они остались бы в календаре навсегда.
    const removed = await Event.deleteMany({
        org, source,
        externalId: { $nin: Array.from(seen) },
        externalCalendarId: { $in: [...calendars, "", null] },
        date: { $gte: from, $lte: to },
    });

    return { created, updated, removed: removed.deletedCount ?? 0 };
}
