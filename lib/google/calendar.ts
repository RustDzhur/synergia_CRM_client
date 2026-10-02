import { ProviderError, fetchProvider } from "@/lib/http";
import { EVENT_TZ_RE, shiftDay } from "@/lib/events";
import { findGcal, gcalToken } from "@/lib/google";
import { prisma } from "@/lib/prisma";
import { type ExternalEvent, upsertExternalEvents } from "@/lib/calendar/sources";

// Google Calendar API v3 без SDK — как и Drive, обычными запросами.
// Календарь фирмы и календарь Google должны совпадать в обе стороны: события из Google приезжают сюда,
// а созданные здесь — уезжают туда. Поэтому кроме чтения нужно право на изменение событий
// (calendar.events), а список календарей по-прежнему читается по calendar.readonly.
const base = () => (process.env.GOOGLE_CALENDAR_API_URL || "https://www.googleapis.com/calendar/v3").replace(/\/+$/, "");

export const GCAL_READ_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
export const GCAL_WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const GCAL_SCOPE = `${GCAL_READ_SCOPE} ${GCAL_WRITE_SCOPE}`;

/** Соединение умеет писать, только если при согласии выдали право на изменение событий.
 *  Старое подключение (scopes не сохранены) писать не может — человека попросят подключиться заново. */
export const gcalWritable = (scopes?: string) => (scopes ?? "").split(/\s+/).includes(GCAL_WRITE_SCOPE);

interface GoogleCalendar { id: string; summary?: string; backgroundColor?: string; primary?: boolean; accessRole?: string }
interface GoogleEvent {
    id?: string;
    status?: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    recurringEventId?: string;
    timeZone?: string; // пояс события: храним его, чтобы правка не уехала обратно со сдвигом
}
// Документ интеграции: запись Prisma (её читают/пишут эти функции)
type Doc = any;

async function calendar<T>(token: string, path: string, params: Record<string, string> = {}, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const q = new URLSearchParams(params).toString();
    const res = await fetchProvider(
        `${base()}${path}${q ? `?${q}` : ""}`,
        {
            method: init.method ?? "GET",
            headers: { Authorization: `Bearer ${token}`, ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
            ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        },
        20000
    );
    if (init.method === "DELETE" && res.ok) return undefined as T; // в ответ на удаление Google тела не присылает
    const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    if (!res.ok || !json) {
        const message = json?.error?.message ?? `Google Calendar error ${res.status}`;
        // «недостаточно прав» — это подключение, выданное только на чтение: его нужно повторить
        throw new ProviderError(/insufficient|scope/i.test(message) ? "Google Calendar is connected read-only. Reconnect it to allow changes." : message);
    }
    return json;
}

/** Календари пользователя: список нужен, чтобы показать их в настройках и дать выбрать */
export async function listCalendars(token: string): Promise<GoogleCalendar[]> {
    const r = await calendar<{ items?: GoogleCalendar[] }>(token, "/users/me/calendarList", { maxResults: "100" });
    return (r.items ?? []).filter((c) => c.accessRole !== "freeBusyReader");
}

/**
 * События одного календаря за период.
 * singleEvents=true просит Google сам развернуть повторы — для повторяющихся событий это
 * единственный разумный способ: свой разбор RRULE для Google не нужен.
 * complete=false означает, что выдача не влезла в отведённые страницы: по такому календарю
 * нельзя судить, что события нет, и удалять по нему ничего не разрешено (см. googleSync).
 */
export async function listEvents(token: string, calendarId: string, from: string, to: string): Promise<{ items: GoogleEvent[]; complete: boolean }> {
    const out: GoogleEvent[] = [];
    let pageToken = "";
    // Ограничение по страницам: календарь с очень плотным расписанием не должен тянуть весь год
    for (let page = 0; page < 10; page++) {
        const r = await calendar<{ items?: GoogleEvent[]; nextPageToken?: string }>(
            token,
            `/calendars/${encodeURIComponent(calendarId)}/events`,
            {
                timeMin: `${from}T00:00:00Z`,
                timeMax: `${to}T23:59:59Z`,
                singleEvents: "true",
                orderBy: "startTime",
                maxResults: "250",
                ...(pageToken ? { pageToken } : {}),
            }
        );
        out.push(...(r.items ?? []));
        pageToken = r.nextPageToken ?? "";
        if (!pageToken) return { items: out, complete: true };
    }
    return { items: out, complete: false };
}

const local = (dateTime?: string, date?: string) => {
    if (date) return { date, time: "00:00", allDay: true };
    if (!dateTime) return null;
    // Google отдаёт время со сдвигом («2026-09-27T14:00:00+02:00») — берём первые 16 символов,
    // то есть местное время в поясе календаря, а не пересчитанное в UTC
    return { date: dateTime.slice(0, 10), time: dateTime.slice(11, 16), allDay: false };
};

/** Сдвиг из значения времени Google («+02:00» → 120 минут): без него правка уехала бы с чужим поясом */
const offsetOf = (dateTime?: string) => {
    if (!dateTime) return undefined;
    const m = /([+-])(\d{2}):?(\d{2})$/.exec(dateTime);
    if (m) return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
    return /Z$/.test(dateTime) ? 0 : undefined;
};

// ── Запись ────────────────────────────────────────────────────────────────────────────────────────────
// Событие CRM хранит «настенное» время (date + startTime) и пояс автора в минутах, поэтому в Google
// уходит дата-время со сдвигом: 2026-09-28T14:00:00+02:00. Так же и обратно: пояс остаётся тем,
// что записан в событии, и перенос события между календарями его не меняет.

const pad = (n: number) => String(n).padStart(2, "0");

const isoShift = (minutes: number) => {
    const m = Number.isFinite(minutes) ? Math.max(-840, Math.min(840, Math.round(minutes))) : 0;
    return `${m < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(m) / 60))}:${pad(Math.abs(m) % 60)}`;
};

const plusHour = (day: string, time: string) => {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + 60;
    return { day: shiftDay(day, Math.floor(total / 1440)), time: `${pad(Math.floor((total % 1440) / 60))}:${pad(total % 60)}` };
};

/** Событие «на весь день»: так их хранит импорт, и так их можно ввести в форме (00:00–23:59).
 *  Отдельного режима «весь день» у формы нет — она принимает те же два времени */
export const eventAllDay = (e: { startTime?: string; endTime?: string }) => e.startTime === "00:00" && (!e.endTime || e.endTime === "23:59" || e.endTime === "00:00");

export interface EventTimes {
    title: string;
    description?: string;
    location?: string;
    date: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    tzOffset?: number;
    tzName?: string;
}

/** Тело события для Google: то же, что показывает форма, только с поясом и в формате API */
export function eventBody(e: EventTimes) {
    // Описание и место отправляем всегда, даже пустыми: PATCH в Google меняет только присланные поля,
    // поэтому очищенное в CRM описание иначе осталось бы в Google и вернулось бы обратно при синхронизации
    const head = { summary: e.title, description: e.description ?? "", location: e.location ?? "" };
    const lastDay = e.endDate && e.endDate >= e.date ? e.endDate : e.date;
    // У события «на весь день» конец в Google исключающий: последний день плюс один
    if (eventAllDay(e)) return { ...head, start: { date: e.date }, end: { date: shiftDay(lastDay, 1) } };

    const startTime = e.startTime || "09:00";
    let endDay = lastDay;
    let endTime = e.endTime || startTime;
    // Google не принимает событие нулевой длины: конец раньше начала сдвигаем на час вперёд
    if (`${endDay}T${endTime}` <= `${e.date}T${startTime}`) ({ day: endDay, time: endTime } = plusHour(e.date, startTime));
    // Пояс передаём именем, если он известен: сдвиг в минутах — это сегодняшнее смещение, а событие
    // может стоять на дату, когда в том же поясе действует другое время (летнее/зимнее), и Google
    // сдвинул бы его на час. Без имени остаётся только сегодняшний сдвиг — так писали до этого.
    const zone = e.tzName && EVENT_TZ_RE.test(e.tzName) ? { timeZone: e.tzName } : null;
    const stamp = (day: string, time: string) =>
        zone ? { dateTime: `${day}T${time}:00`, ...zone } : { dateTime: `${day}T${time}:00${isoShift(e.tzOffset ?? 0)}` };
    return { ...head, start: stamp(e.date, startTime), end: stamp(endDay, endTime) };
}

/** Создать событие в календаре Google; возвращает его id у Google */
export async function insertEvent(token: string, calendarId: string, body: ReturnType<typeof eventBody>): Promise<string> {
    const r = await calendar<{ id?: string }>(token, `/calendars/${encodeURIComponent(calendarId)}/events`, {}, { method: "POST", body });
    if (!r?.id) throw new ProviderError("Google did not confirm the new event");
    return r.id;
}

/** Изменить событие в Google: правка в CRM должна быть видна и там */
export async function patchEvent(token: string, calendarId: string, eventId: string, body: ReturnType<typeof eventBody>): Promise<void> {
    await calendar(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {}, { method: "PATCH", body });
}

export async function removeEvent(token: string, calendarId: string, eventId: string): Promise<void> {
    await calendar(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {}, { method: "DELETE" });
}

// ── Настройки интеграции ──────────────────────────────────────────────────────────────────────────────

/** Календари, отмеченные для синхронизации; если выбор не сделан — все */
export function gcalCalendars(doc: Doc): Array<{ id: string; name: string; enabled: boolean; primary?: boolean }> {
    const list = doc.config?.calendars;
    return Array.isArray(list) ? (list as Array<{ id: string; name: string; enabled: boolean; primary?: boolean }>) : [];
}

/** Календарь, в который пишут события фирмы: выбранный в настройках, иначе основной */
export function gcalTarget(doc: Doc): string {
    const list = gcalCalendars(doc);
    const chosen = String(doc.config?.target ?? "");
    // Выбранный календарь мог исчезнуть из Google (его удалили или отписались): писать в него нельзя,
    // поэтому возвращаемся к основному. Пустой список означает, что выбора ещё не было.
    if (chosen && (!list.length || list.some((c) => c.id === chosen))) return chosen;
    return list.find((c) => c.primary)?.id ?? "primary";
}

/** Записи календарей для настроек: имя, признак основного и прежний выбор «синхронизировать» */
export function toCalendarEntries(list: Array<{ id: string; summary?: string; primary?: boolean }>, known: Map<string, { enabled?: boolean }> = new Map()) {
    return list.map((c) => ({ id: c.id, name: c.summary ?? c.id, enabled: known.get(c.id)?.enabled ?? true, primary: c.primary ?? false }));
}

export async function setGcalTarget(owner: string, id: string) {
    const doc = await findGcal(owner);
    if (!doc) throw new ProviderError("Google Calendar is not connected");
    await prisma.integration.update({ where: { id: doc.id }, data: { config: { ...((doc.config ?? {}) as any), target: id } as any } });
}

export async function setGcalCalendars(owner: string, enabledIds: string[]) {
    const doc = await findGcal(owner);
    if (!doc) throw new ProviderError("Google Calendar is not connected");
    const enabled = new Set(enabledIds);
    await prisma.integration.update({ where: { id: doc.id }, data: { config: { ...((doc.config ?? {}) as any), calendars: gcalCalendars(doc).map((c) => ({ ...c, enabled: enabled.has(c.id) })) } as any } });
}

// Календарь, в который мы только что записали событие, обязан вернуться в CRM при следующей
// синхронизации: иначе событие, созданное здесь, пропало бы из календаря фирмы
async function enableCalendar(doc: Doc, id: string) {
    const list = gcalCalendars(doc);
    const item = list.find((c) => c.id === id);
    if (!item || item.enabled) return;
    await prisma.integration.update({ where: { id: doc.id }, data: { config: { ...((doc.config ?? {}) as any), calendars: list.map((c) => (c.id === id ? { ...c, enabled: true } : c)) } as any } });
}

// ── Связь с календарём фирмы ──────────────────────────────────────────────────────────────────────────

export interface EventDoc extends EventTimes {
    externalId?: string;
    externalCalendarId?: string;
    /** источник события: связь с Google есть только у source === "google" */
    source?: string;
}

export interface PushResult { id: string; calendarId: string }

/**
 * Перенести событие фирмы в Google: создаёт новое или изменяет уже связанное.
 * Возвращает null, если календарь не подключён, — тогда событие живёт только в CRM.
 */
export async function pushEvent(org: string, event: EventDoc): Promise<PushResult | null> {
    const doc = (await findGcal(org)) as Doc | null;
    if (!doc || doc.status !== "connected") return null;
    const token = await gcalToken(doc);
    const calendarId = event.externalCalendarId || gcalTarget(doc);
    const body = eventBody(event);
    // externalId бывает и у событий не из Google: перенос старых событий из localStorage хранит там
    // свой идентификатор. Связь с Google — только когда событие помечено источником «google».
    if (event.source === "google" && event.externalId) {
        await patchEvent(token, calendarId, event.externalId, body);
        return { id: event.externalId, calendarId };
    }
    const id = await insertEvent(token, calendarId, body);
    await enableCalendar(doc, calendarId);
    return { id, calendarId };
}

/** Удалить связанное событие в Google. Если календарь отключён, чистить нечего — молча выходим. */
export async function removeExternal(org: string, event: EventDoc): Promise<void> {
    if (!event.externalId) return;
    const doc = (await findGcal(org)) as Doc | null;
    if (!doc || doc.status !== "connected") return;
    const token = await gcalToken(doc);
    await removeEvent(token, event.externalCalendarId || gcalTarget(doc), event.externalId);
}

interface SyncableEvent extends EventDoc {
    calendar?: string;
}

export interface SyncResult {
    error: string;
    source?: string;
    externalId?: string;
    externalCalendarId?: string;
}

// Предупреждение для событий из iCloud: их правки и удаления не уходят в Apple, и синхронизация
// вернёт прежнюю версию — человеку нужно сказать это сразу, а не показывать успех
export const ICLOUD_NOT_WRITABLE = "iCloud is read-only: the change stays in Firmspace and will be replaced by the next sync.";

/**
 * Перенести событие в Google и запомнить связь с ним. Возвращает текст ошибки, если перенести
 * не удалось, и пустую строку при успехе или когда переносить некуда.
 * Ошибка не отменяет сохранение: событие уже лежит в CRM, важно лишь сказать человеку, что в Google
 * его нет, — иначе он будет ждать его в телефоне.
 */
export async function syncEvent(org: string, event: SyncableEvent): Promise<SyncResult> {
    // iCloud подключается только на чтение: правка в CRM туда не уедет и будет перезаписана
    // следующей синхронизацией. Молчать об этом нельзя — иначе человек решит, что изменил событие
    if (event.source === "icloud") return { error: ICLOUD_NOT_WRITABLE };
    // Личное событие в Google не записываем: календарь для записи принадлежит фирме и может быть
    // виден нескольким людям, а приватная встреча туда попадать не должна. Ранее записанное личное
    // событие отвязывает вызывающий (app/api/events/[id])
    if (event.calendar === "my") return { error: "" };
    try {
        const pushed = await pushEvent(org, event);
        if (!pushed) return { error: "" };
        return { error: "", source: "google", externalId: pushed.id, externalCalendarId: pushed.calendarId };
    } catch (e) {
        return { error: e instanceof Error ? e.message : "Google Calendar did not accept the event" };
    }
}

/** Переносит события выбранных календарей в календарь фирмы */
export async function googleSync(org: string, from: string, to: string): Promise<{ created: number; updated: number; removed: number }> {
    const doc = await findGcal(org);
    if (!doc || doc.status !== "connected") return { created: 0, updated: 0, removed: 0 };
    const token = await gcalToken(doc);

    let chosen = gcalCalendars(doc).filter((c) => c.enabled);
    // Первый запуск после подключения: список календарей ещё не сохранён — берём все и запоминаем
    if (!gcalCalendars(doc).length) {
        const all = await listCalendars(token);
        const entries = toCalendarEntries(all);
        chosen = entries;
        await prisma.integration.update({ where: { id: doc.id }, data: { config: { ...((doc.config ?? {}) as any), calendars: entries } as any } });
    }

    const events: ExternalEvent[] = [];
    // Календари, чью выдачу получили целиком: только по ним можно удалять пропавшие события
    const complete: string[] = [];
    for (const cal of chosen) {
        const { items, complete: full } = await listEvents(token, cal.id, from, to);
        if (full) complete.push(cal.id);
        for (const it of items) {
            if (it.status === "cancelled" || !it.id) continue;
            const start = local(it.start?.dateTime, it.start?.date);
            if (!start) continue;
            const end = local(it.end?.dateTime, it.end?.date) ?? start;
            events.push({
                externalId: it.id,
                calendarId: cal.id,
                title: it.summary ?? "",
                description: it.description ?? "",
                location: it.location ?? "",
                date: start.date,
                startTime: start.allDay ? "00:00" : start.time,
                // У «весь день» конец в Google исключающий (первый день после события), а форма хранит
                // последний день включительно — иначе событие каждый раз удлинялось бы при переносе туда-обратно
                endDate: end.allDay ? shiftDay(end.date, -1) : end.date,
                endTime: end ? (end.allDay ? "23:59" : end.time) : start.time,
                // Пояс события запоминаем вместе с ним: правка из другого пояса иначе уехала бы
                // в Google с чужим сдвигом (см. eventBody)
                ...(start.allDay ? {} : { tzOffset: offsetOf(it.start?.dateTime), tzName: it.timeZone ?? "" }),
            });
        }
    }
    return upsertExternalEvents(org, "google", events, from, to, complete);
}

/** Отключение: удаляем интеграцию вместе с токенами. Импортированные события остаются в календаре —
 *  человек их видит и решает сам, убирать ли; повторное подключение обновит их по externalId. */
export async function disconnect(owner: string) {
    await prisma.integration.deleteMany({ where: { owner, type: "gcal" } });
}
