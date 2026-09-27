import { ProviderError } from "@/lib/http";
import { packSecrets, secretsOf } from "@/lib/integrations";
import { shiftDay } from "@/lib/events";
import { upsertExternalEvents, type ExternalEvent } from "@/lib/calendar/sources";
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
    const pass = password.replace(/\s+/g, "");
    if (!/^\S+@\S+\.\S+$/.test(user)) throw new ProviderError("Enter the Apple ID (e-mail)");
    if (!pass) throw new ProviderError("Enter the app-specific password");
    let calendars;
    try {
        calendars = await discoverCalendars(user, pass);
    } catch (e) {
        if (e instanceof CalDavAuthError) throw new ProviderError(e.message);
        throw new ProviderError("Could not reach iCloud. Check the connection and try again.");
    }

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
export async function icloudSync(org: string, from: string, to: string): Promise<{ created: number; updated: number; removed: number }> {
    const doc = await findIcloud(org);
    if (!doc || doc.status !== "connected") return { created: 0, updated: 0, removed: 0 };

    const appleId = String(doc.config?.appleId ?? "");
    const password = (secretsOf<IcloudSecrets>(doc).password ?? "").toString();
    if (!appleId || !password) throw new ProviderError("iCloud is not connected");

    // Пояс, по которому показывать события: у самой фирмы он один, берём у владельца
    const tz = await ownerOffset(org);
    const events: ExternalEvent[] = [];
    const chosen = icloudCalendars(doc).filter((c) => c.enabled);
    for (const calendar of chosen) {
        const items = await fetchCalendarEvents(appleId, password, calendar.href, from, to, tz);
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
    // Обойденные календари передаём в базу: событие выключенного календаря не удаляется —
    // человек отказался от обновления, а не от самих событий
    return upsertExternalEvents(org, "icloud", events, from, to, chosen.map((c) => c.href));
}

/** Часовой пояс фирмы: у события в календаре он берётся с профиля владельца, иначе +0 */
async function ownerOffset(org: string): Promise<number> {
    const User = (await import("@/models/User")).default;
    const owner = await User.findById(org).select("timezone").lean<{ timezone?: string }>().catch(() => null);
    // timezone в профиле — свободный текст, поэтому доверяем только числу минут
    const n = Number(owner?.timezone);
    return Number.isFinite(n) ? Math.max(-840, Math.min(840, n)) : 0;
}
