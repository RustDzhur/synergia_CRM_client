import { fetchProvider } from "@/lib/http";
import { parseIcal, type IcalOccurrence } from "./parse";

// Клиент CalDAV. Так отдают календари iCloud (и большинство корпоративных серверов): обычный HTTP
// с методами PROPFIND и REPORT и XML в теле. Библиотеки для этого в проекте нет и поставить нечего,
// поэтому запросы собираются строками, а ответы разбираются регулярными выражениями — структура
// ответа CalDAV плоская (multistatus → response → propstat → prop), и полноценный XML-парсер здесь
// был бы тяжелее самого разбора.

const DAV = "DAV:";
const CALDAV = "urn:ietf:params:xml:ns:caldav";
const DEFAULT_BASE = "https://caldav.icloud.com";

// Адрес сервера можно переопределить — нужно для проверки без настоящего аккаунта.
// Значение может прийти без схемы, а совсем неразбираемое лучше игнорировать: с ним запрос ушёл бы
// в никуда, и причина выглядела бы как «ENOTFOUND» вместо понятной ошибки настройки.
const base = () => {
    const raw = (process.env.ICLOUD_CALDAV_URL || "").trim().replace(/\/+$/, "");
    if (!raw) return DEFAULT_BASE;
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        // localhost оставляем: переопределение нужно именно для проверки на своём стенде
        const { hostname } = new URL(withScheme);
        return hostname.includes(".") || hostname === "localhost" || hostname === "::1" ? withScheme : DEFAULT_BASE;
    } catch {
        return DEFAULT_BASE;
    }
};

/**
 * Адрес запроса из href. Apple отдаёт их и относительными («/123456789/principal/»), и полными
 * («https://p12-caldav.icloud.com/123456789/principal/») — причём полный адрес может вести на другой
 * узел, куда аккаунт приписан. Приклеивать полный адрес к своему нельзя: получается
 * «https://caldav.icloud.comhttps://…», и запрос уходит в никуда (ENOTFOUND caldav.icloud.comhttps).
 * new URL сам разбирает оба вида: относительный считает от нашего адреса, полный берёт как есть.
 */
const endpoint = (href: string) => new URL(href, `${base()}/`).toString();

export interface CalDavCalendar {
    href: string;       // путь календаря для REPORT
    name: string;
    color: string;
}

export class CalDavAuthError extends Error {}

const authHeader = (user: string, password: string) =>
    "Basic " + Buffer.from(`${user}:${password}`, "utf8").toString("base64");

async function dav(user: string, password: string, path: string, method: string, body?: string, depth = "0", step = ""): Promise<string> {
    const res = await fetchProvider(endpoint(path), {
        method,
        headers: {
            Authorization: authHeader(user, password),
            // Как у обычного календарного клиента: Apple одинаково принимает и без него, но с ним
            // запрос выглядит как поддерживаемое приложение, а не как безымянный скрипт
            "User-Agent": "Firmspace CRM calendar sync",
            ...(body ? { "Content-Type": "application/xml; charset=utf-8" } : {}),
            Depth: depth,
        },
        ...(body ? { body } : {}),
    }, 20000);

    const text = await res.text();
    if (res.status === 401 || res.status === 403) throw new CalDavAuthError("Apple rejected the Apple ID or the app-specific password");
    // Шаг важен: без него в окне было бы просто «ошибка 400», и непонятно, что именно Apple не приняла
    if (res.status >= 400) throw new Error(`iCloud refused the request (HTTP ${res.status}${step ? `, ${step}` : ""})`);
    return text;
}

/** Значение первого тега с данным именем (пространство имён в ответах iCloud всегда префиксное) */
function tag(xml: string, name: string): string {
    const m = new RegExp(`<[^>]*:?${name}[^>]*>([\\s\\S]*?)</[^>]*:?${name}>`, "i").exec(xml);
    return m ? decodeXml(m[1].trim()) : "";
}

const decodeXml = (s: string) =>
    s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Разбивает multistatus на отдельные <response> */
const responses = (xml: string) => xml.split(/<[^>]*:?response[\s>]/i).slice(1);

/**
 * Адрес календарей пользователя: сначала principal, потом calendar-home-set.
 * Без этого шага неизвестно, где именно лежат календари — у iCloud путь содержит номер раздела аккаунта.
 */
export async function discoverCalendars(user: string, password: string): Promise<CalDavCalendar[]> {
    const principalXml = await dav(user, password, "/", "PROPFIND",
        `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="${DAV}"><d:prop><d:current-user-principal/></d:prop></d:propfind>`, "0", "sign-in");
    // principal приходит как <d:href>/123456789/principal/</d:href>
    const principal = decodeXml(/<[^>]*current-user-principal[^>]*>[\s\S]*?<[^>]*href[^>]*>([^<]+)</i.exec(principalXml)?.[1] ?? "");
    if (!principal) throw new CalDavAuthError("Apple did not return a calendar principal for this account");

    const homeXml = await dav(user, password, principal, "PROPFIND",
        `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="${DAV}" xmlns:c="${CALDAV}"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`, "0", "address of the calendars");
    const home = decodeXml(/<[^>]*calendar-home-set[^>]*>[\s\S]*?<[^>]*href[^>]*>([^<]+)</i.exec(homeXml)?.[1] ?? "");
    if (!home) throw new CalDavAuthError("Apple did not return a calendar home for this account");

    const listXml = await dav(user, password, home, "PROPFIND",
        `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="${DAV}" xmlns:c="${CALDAV}" xmlns:cs="http://calendarserver.org/ns/"><d:prop><d:displayname/><d:resourcetype/><cs:calendar-color/></d:prop></d:propfind>`,
        "1", "calendar list");

    const out: CalDavCalendar[] = [];
    for (const block of responses(listXml)) {
        // берём только те записи, что помечены как календарь: в выдаче есть и служебные узлы
        if (!/calendar[^>]*\/?>|:calendar[\s/>]/i.test(block)) continue;
        const href = tag(block, "href");
        if (!href || !/\/$/.test(href)) continue;
        const name = tag(block, "displayname") || href.replace(/\/$/, "").split("/").pop() || "Calendar";
        // цвет приходит как #RRGGBBAA — берём первые семь символов
        const color = (tag(block, "calendar-color") || "").slice(0, 7);
        out.push({ href, name, color: /^#[0-9a-f]{6}$/i.test(color) ? color : "" });
    }
    return out;
}

/** События одного календаря за период. Повторы разворачивает разбор iCalendar. */
export async function fetchCalendarEvents(
    user: string,
    password: string,
    calendarHref: string,
    from: string,
    to: string,
    tzOffsetMinutes = 0
): Promise<IcalOccurrence[]> {
    // Границы окна — в формате UTC: CalDAV ждёт время по Гринвичу, поэтому прибавляем обратный сдвиг
    const start = `${from.replace(/-/g, "")}T000000Z`;
    const end = `${to.replace(/-/g, "")}T235959Z`;
    const body = `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="${DAV}" xmlns:c="${CALDAV}">
  <d:prop><d:getetag/><c:calendar-data/></d:prop>
  <c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">
    <c:time-range start="${start}" end="${end}"/>
  </c:comp-filter></c:comp-filter></c:filter>
</c:calendar-query>`;

    const xml = await dav(user, password, calendarHref, "REPORT", body, "1", "events of one calendar");
    const out: IcalOccurrence[] = [];
    for (const block of responses(xml)) {
        const data = /<[^>]*calendar-data[^>]*>([\s\S]*?)<\/[^>]*calendar-data>/i.exec(block)?.[1];
        if (!data) continue;
        out.push(...parseIcal(decodeXml(data), from, to, tzOffsetMinutes));
    }
    return out;
}
