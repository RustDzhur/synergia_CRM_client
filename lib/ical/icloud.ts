import { ProviderError } from "@/lib/http";
import { packSecrets, secretsOf } from "@/lib/integrations";
import { shiftDay } from "@/lib/events";
import { type ExternalEvent, upsertExternalEvents } from "@/lib/calendar/sources";
import type { HydratedDocument } from "mongoose";
import Integration from "@/models/Integration";

type Doc = HydratedDocument<any>;
import { CalDavAuthError, discoverCalendars, fetchCalendarEvents } from "./caldav";

// Календарь iCloud. У Apple нет обычного OAuth для календарей: доступ даётся по Apple ID и
// паролю приложения (создаётся на appleid.apple.com), а события отдаются по CalDAV.
// Пароль хранится зашифрованным, как и остальные секреты интеграций.

export const findIcloud = (owner: string) => Integration.findOne({ owner, type: "icloud" });

interface IcloudSecrets { password?: string }

/**
 * Подключение: сначала проверяем, что Apple пускает с этими данными и что календари вообще видны.
 * Иначе в интерфейсе появилось бы «подключено», которое ничего не синхронизирует.
 */
export async function connectIcloud(owner: string, appleId: string, password: string) {
    const user = appleId.trim().toLowerCase();
    // Пароль приложения Apple — 16 строчных букв и цифр, показанные четырьмя группами. Приводим введённое
    // к этому виду: убираем пробелы, невидимые символы и «неправильные» дефисы из буфера обмена.
    // Иначе скопированный из браузера пароль отвергался бы как неверный из-за одного невидимого знака,
    // а человек был бы уверен, что ввёл его правильно.
    const entered = password.replace(/[^A-Za-z0-9-]/g, "").toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(user)) throw new ProviderError("Enter the Apple ID (e-mail)");
    if (!entered) throw new ProviderError("Enter the app-specific password");

    // Apple показывает пароль приложения группами через дефис. Одни клиенты принимают его как есть,
    // другие — без дефисов, и заранее неизвестно, какой случай наш. Пробуем оба варианта и запоминаем
    // тот, с которым Apple пустила: иначе человек видел бы «неверный пароль» при верном пароле.
    const candidates = entered.includes("-") ? [entered, entered.replace(/-/g, "")] : [entered];
    let calendars: Awaited<ReturnType<typeof discoverCalendars>> = [];
    let pass = entered;
    let failure: unknown = null;
    for (const candidate of candidates) {
        try {
            calendars = await discoverCalendars(user, candidate);
            pass = candidate;
            failure = null;
            break;
        } catch (e) {
            failure = e;
            // Второй вариант помогает только при отказе в доступе; на любой другой ошибке повторять незачем
            if (!(e instanceof CalDavAuthError)) break;
        }
    }

    if (failure) {
        if (failure instanceof CalDavAuthError) throw new ProviderError(failure.message);
        // Ошибку сети и отказ Apple показываем как есть: в ней есть шаг и код ответа,
        // по которым понятно, на чём именно всё встало
        if (failure instanceof Error) throw new ProviderError(failure.message);
        throw new ProviderError("Could not reach iCloud. Check the connection and try again.");
    }
    // Подключение без календарей выглядело бы рабочим, но синхронизировать было бы нечего
    if (!calendars.length) throw new ProviderError("Apple returned no calendars for this account. Check that Calendar is switched on in iCloud settings.");

    const doc = (await findIcloud(owner)) ?? new Integration({ owner, type: "icloud", token: `icloud-${owner}-${Date.now()}` });
    doc.config = { appleId: user, calendars: calendars.map((c) => ({ href: c.href, name: c.name, enabled: true })) };
    doc.secrets = packSecrets({ password: pass });
    doc.status = "connected";
    doc.error = "";
    await doc.save();
    return { calendars: calendars.map((c) => c.name) };
}

export async function disconnectIcloud(owner: string) {
    await Integration.deleteOne({ owner, type: "icloud" });
}

export function icloudCalendars(doc: Doc): Array<{ href: string; name: string; enabled: boolean }> {
    const list = (doc.config?.calendars ?? []) as Array<{ href: string; name: string; enabled: boolean }>;
    return Array.isArray(list) ? list : [];
}

export async function setIcloudCalendars(owner: string, enabledHrefs: string[]) {
    const doc = await findIcloud(owner);
    if (!doc) throw new ProviderError("iCloud is not connected");
    const enabled = new Set(enabledHrefs);
    doc.config = { ...(doc.config ?? {}), calendars: icloudCalendars(doc).map((c) => ({ ...c, enabled: enabled.has(c.href) })) };
    await doc.save();
}

/**
 * Переносит события выбранных календарей в календарь фирмы.
 * Идемпотентно: запись идёт по (org, source, externalId), см. lib/calendar/sources.ts.
 */
export async function icloudSync(org: string, from: string, to: string): Promise<{ created: number; updated: number; removed: number; warning?: string }> {
    const doc = await findIcloud(org);
    if (!doc || doc.status !== "connected") return { created: 0, updated: 0, removed: 0 };

    const appleId = String(doc.config?.appleId ?? "");
    const password = (secretsOf<IcloudSecrets>(doc).password ?? "").toString();
    if (!appleId || !password) throw new ProviderError("iCloud is not connected");

    // Пояс, по которому показывать события: у самой фирмы он один, берём у владельца
    const tz = await ownerOffset(org);
    const events: ExternalEvent[] = [];
    const chosen = icloudCalendars(doc).filter((c) => c.enabled);
    // Календари, которые ответили: по ним можно удалять пропавшие события, по остальным — нельзя,
    // иначе события непокорённого календаря исчезли бы из CRM как «пропавшие у провайдера»
    const answered: string[] = [];
    const refused: string[] = [];
    for (const calendar of chosen) {
        let items;
        try {
            items = await fetchCalendarEvents(appleId, password, calendar.href, from, to, tz, calendar.name);
        } catch (e) {
            // Один календарь не должен останавливать остальные: Apple отвечает отказом на служебные
            // коллекции, и из-за одной такой синхронизация не должна пропадать целиком
            refused.push(calendar.name || calendar.href);
            continue;
        }
        answered.push(calendar.href);
        for (const it of items) {
            const day = it.start.slice(0, 10);
            // У события «на весь день» конец в iCalendar исключающий (RFC 5545), а форма хранит последний
            // день включительно: без этого однодневное событие ложилось бы в календарь двумя днями
            const lastDay = it.allDay ? shiftDay(it.end.slice(0, 10), -1) : it.end.slice(0, 10);
            events.push({
                externalId: it.uid,
                calendarId: calendar.href,
                title: it.title || "(ohne Titel)",
                description: it.description,
                location: it.location,
                date: day,
                startTime: it.allDay ? "00:00" : it.start.slice(11, 16),
                endDate: lastDay < day ? day : lastDay,
                endTime: it.allDay ? "23:59" : it.end.slice(11, 16),
                // Пояс фирмы: время из iCloud пересчитано в него, и он же должен уехать обратно,
                // если событие когда-нибудь станет доступно для правки
                tzOffset: tz,
            });
        }
    }
    // Ни один календарь не ответил — значит сломалось что-то общее (доступ, пароль), и об этом
    // нужно сказать как об ошибке подключения
    if (!answered.length && refused.length) throw new ProviderError(`iCloud refused every calendar: ${refused.join(", ")}`);

    // В удаление передаём только ответившие календари: событие выключенного или непокорённого календаря
    // удалять нельзя — человек отказался от обновления, а не от самих событий
    const result = await upsertExternalEvents(org, "icloud", events, from, to, answered);
    // Часть календарей отказала: синхронизация состоялась, но об этом стоит сказать в окне настроек
    return refused.length ? { ...result, warning: `iCloud did not return events for: ${refused.join(", ")}` } : result;
}

/** Часовой пояс фирмы: у события в календаре он берётся с профиля владельца, иначе +0 */
async function ownerOffset(org: string): Promise<number> {
    const User = (await import("@/models/User")).default;
    const owner = await User.findById(org).select("timezone").lean<{ timezone?: string }>().catch(() => null);
    // timezone в профиле — свободный текст, поэтому доверяем только числу минут
    const n = Number(owner?.timezone);
    return Number.isFinite(n) ? Math.max(-840, Math.min(840, n)) : 0;
}
