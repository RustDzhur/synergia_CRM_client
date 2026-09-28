import { createHmac } from "crypto";
import { fetchProvider, ProviderError } from "@/lib/http";
import { safeEqual } from "@/lib/crypto";

const base = () => (process.env.GRAPH_API_URL || "https://graph.facebook.com/v19.0").replace(/\/+$/, "");

/** Запрос к Graph API без токена доступа: он нужен шагам входа, где токен ещё только получаем */
async function graphRaw<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchProvider(`${base()}${path}`, init);
    const json = (await res.json().catch(() => null)) as (T & { error?: { message: string } }) | null;
    if (!res.ok || !json || json.error) {
        const message = json?.error?.message ?? `Facebook error ${res.status}`;
        // Самая частая причина отказа — не тот токен: в кабинете Meta рядом лежат токены пользователя,
        // страницы и приложения, и внешне они не отличаются. Говорим прямо, какой нужен.
        const hint = /invalid oauth|expired|parse access token|session has been invalidated/i.test(message)
            ? " — use the Page access token of the page (Meta also shows user and app tokens, they will not work)"
            : "";
        throw new ProviderError(`${message}${hint}`);
    }
    return json;
}

async function graph<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    return graphRaw<T>(`${path}${sep}access_token=${encodeURIComponent(accessToken)}`, init);
}

export const getPage = (accessToken: string) => graph<{ id: string; name: string }>("/me?fields=id,name", accessToken);

// ── Вход через Facebook ───────────────────────────────────────────────────────────────────────────────
// Вместо копирования длинных токенов вручную человек выбирает страницу в окне самого Facebook, а токен
// страницы мы получаем сами: код → короткий токен пользователя → долгий токен → список страниц с их
// токенами. Токены страниц, полученные от долгого токена, не истекают — это и нужно для переписки.

const version = () => new URL(base()).pathname.replace(/^\/+/, ""); // «v19.0» из адреса Graph API

/** Адрес окна входа: человек выбирает страницу, нам возвращается код */
export function messengerOauthUrl(appId: string, redirectUri: string, state: string) {
    const scope = ["pages_show_list", "pages_messaging", "pages_manage_metadata"].join(",");
    const q = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, state, response_type: "code", scope });
    return `https://www.facebook.com/${version()}/dialog/oauth?${q}`;
}

export async function exchangeMessengerCode(appId: string, appSecret: string, redirectUri: string, code: string): Promise<string> {
    const q = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code });
    const r = await graphRaw<{ access_token?: string }>(`/oauth/access_token?${q}`);
    if (!r.access_token) throw new ProviderError("Facebook did not return an access token");
    return r.access_token;
}

/** Короткий токен меняем на долгий: только от него токены страниц не истекают */
export async function longLivedUserToken(appId: string, appSecret: string, shortToken: string): Promise<string> {
    const q = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: shortToken });
    const r = await graphRaw<{ access_token?: string }>(`/oauth/access_token?${q}`);
    return r.access_token || shortToken; // Meta не всегда продлевает — тогда работаем с тем, что дали
}

/** Страницы пользователя вместе с их токенами */
export async function listUserPages(userToken: string): Promise<Array<{ id: string; name: string; access_token: string }>> {
    const r = await graph<{ data?: Array<{ id: string; name: string; access_token: string }> }>("/me/accounts?fields=id,name,access_token&limit=100", userToken);
    return (r.data ?? []).filter((p) => p.id && p.access_token);
}

/** Подписка страницы на приложение: без неё Meta не доставляет события, и переписка не приходит */
export async function subscribeMessengerPage(pageId: string, pageToken: string) {
    await graph<{ success?: boolean }>(`/${pageId}/subscribed_apps`, pageToken, { method: "POST" });
}

/**
 * Адрес вебхука и маркер подтверждения в кабинете Meta — тот шаг, где легко ошибиться: рядом лежат
 * поля для ссылки на страницу CRM и для произвольной строки, а нужны именно наши значения.
 * Meta принимает их и через API — токеном вида «app-id|app-secret», — и сама проверяет адрес.
 */
export async function setMessengerAppWebhook(appId: string, appSecret: string, callbackUrl: string, verifyToken: string) {
    const token = `${appId}|${appSecret}`;
    const q = new URLSearchParams({ object: "page", callback_url: callbackUrl, verify_token: verifyToken, fields: "messages,messaging_postbacks", access_token: token });
    await graphRaw<{ success?: boolean }>(`/${appId}/subscriptions?${q}`, { method: "POST" });
}

/**
 * Похоже ли, что вставили токен пользователя, а не страницы. Различить их по виду нельзя, зато можно
 * спросить у Meta список страниц: у пользователя он есть, у страницы такого ребра нет вовсе.
 * Отказ (нет прав, другая ошибка) считаем «не пользователь» — предупреждать зря не нужно.
 * Возвращает true, только когда Meta уверенно ответила списком страниц.
 */
export async function looksLikeUserToken(accessToken: string): Promise<boolean> {
    try {
        const r = await graph<{ data?: unknown[] }>("/me/accounts?limit=1", accessToken);
        return Array.isArray(r.data);
    } catch {
        return false;
    }
}

/**
 * Проверка формы реквизитов до запроса к Meta. В кабинете токен страницы, токен пользователя и секрет
 * приложения лежат рядом и внешне не отличаются, а Meta на подмену отвечает невнятным «Cannot parse
 * access token» — по нему не понять, что именно вставили не туда. Возвращает текст проблемы или пустую строку.
 */
export function messengerCredentialsProblem(pageAccessToken: string, appSecret: string): string {
    if (!pageAccessToken) return "Enter the Page access token";
    // секрет приложения — ровно 32 шестнадцатеричных знака, токен страницы в разы длиннее
    if (/^[0-9a-f]{32}$/i.test(pageAccessToken)) return "This is the App secret, not the Page access token: the token is much longer. In Meta open Messenger → Settings → Access tokens and copy the Page token.";
    if (pageAccessToken.length < 60 || !/^[A-Za-z0-9_\-|.]+$/.test(pageAccessToken))
        return "The Page access token looks incomplete. Copy it whole from Meta → Messenger → Settings → Access tokens — it is a long string, over 60 characters.";
    if (!appSecret) return "Enter the App secret";
    // обратная путаница: в поле секрета попал токен
    if (appSecret.length > 60 || appSecret.includes("|")) return "This looks like a token, not the App secret: the secret is 32 characters (0–9, a–f) from Meta → Settings → Basic.";
    return "";
}

export async function sendMessenger(accessToken: string, psid: string, text: string) {
    const res = await graph<{ message_id: string }>("/me/messages", accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: psid }, messaging_type: "RESPONSE", message: { text } }),
    });
    return res.message_id;
}

// Имя собеседника Meta отдаёт не всегда — тогда остаётся заглушка
export async function messengerUserName(accessToken: string, psid: string) {
    try {
        const u = await graph<{ name?: string; first_name?: string; last_name?: string }>(`/${psid}?fields=name`, accessToken);
        return u.name || "";
    } catch {
        return "";
    }
}

// X-Hub-Signature-256: "sha256=" + HMAC-SHA256(тело, секрет приложения)
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string) {
    if (!header?.startsWith("sha256=")) return false;
    return safeEqual(createHmac("sha256", appSecret).update(rawBody).digest("hex"), header.slice(7));
}

interface MessagingEvent { sender?: { id: string }; message?: { mid: string; text?: string; is_echo?: boolean; attachments?: { type: string }[] } }

export function parseMessengerBody(body: { object?: string; entry?: { messaging?: MessagingEvent[] }[] }) {
    if (body.object !== "page") return [];
    const events: { externalId: string; text: string; messageId: string }[] = [];
    for (const entry of body.entry ?? []) {
        for (const ev of entry.messaging ?? []) {
            if (!ev.sender?.id || !ev.message || ev.message.is_echo) continue;
            const attachment = ev.message.attachments?.[0]?.type;
            events.push({ externalId: ev.sender.id, text: ev.message.text ?? (attachment ? `[${attachment}]` : "[message]"), messageId: ev.message.mid });
        }
    }
    return events;
}
