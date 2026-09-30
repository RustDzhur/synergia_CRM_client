import { fetchProvider, ProviderError } from "@/lib/http";
import { safeEqual } from "@/lib/crypto";
import { verifyMetaSignature } from "./messenger";

// WHATSAPP_API_URL нужен для собственного прокси Graph API и для локальных проверок без настоящего номера Meta
import { graphBase } from "@/lib/meta";

const base = () => process.env.WHATSAPP_API_URL?.replace(/\/+$/, "") || graphBase();

// Токен передаём заголовком Authorization, а не строкой запроса: так он не попадает в логи прокси
async function graph<T extends object>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchProvider(`${base()}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers as Record<string, string> | undefined) },
    });
    const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    if (!res.ok || !json || json.error) throw new ProviderError(json?.error?.message ?? `WhatsApp error ${res.status}`);
    return json;
}

// ── Вход через Facebook ───────────────────────────────────────────────────────────────────────────────
// Тот же вход, что у Messenger, но права другие: человек выбирает бизнес-аккаунт в окне Facebook,
// а аккаунт WhatsApp Business и номер мы находим сами — искать phone number id вручную не нужно.

const version = () => new URL(base()).pathname.replace(/^\/+/, ""); // «v21.0» из адреса Graph API

export function whatsappOauthUrl(appId: string, redirectUri: string, state: string) {
    const scope = ["business_management", "whatsapp_business_management", "whatsapp_business_messaging"].join(",");
    const q = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, state, response_type: "code", scope });
    return `https://www.facebook.com/${version()}/dialog/oauth?${q}`;
}

/** Запрос без токена: нужен шагам входа, где токен ещё только получаем */
async function graphRaw<T extends object>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchProvider(`${base()}${path}`, init);
    const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    if (!res.ok || !json || json.error) throw new ProviderError(json?.error?.message ?? `WhatsApp error ${res.status}`);
    return json;
}

export async function exchangeWhatsAppCode(appId: string, appSecret: string, redirectUri: string, code: string): Promise<string> {
    const q = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code });
    const r = await graphRaw<{ access_token?: string }>(`/oauth/access_token?${q}`);
    if (!r.access_token) throw new ProviderError("Facebook did not return an access token");
    return r.access_token;
}

/** Короткий токен меняем на долгий: он живёт около 60 дней, за это время переподключение не понадобится */
export async function longLivedWhatsAppToken(appId: string, appSecret: string, shortToken: string): Promise<string> {
    const q = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: shortToken });
    const r = await graphRaw<{ access_token?: string }>(`/oauth/access_token?${q}`);
    return r.access_token || shortToken;
}

export interface WaNumber { wabaId: string; phoneNumberId: string; display: string; verifiedName: string }

const list = async <T extends object>(path: string, token: string): Promise<T[]> => {
    const r = await graph<{ data?: T[] }>(path, token).catch(() => ({ data: [] as T[] }));
    return r.data ?? [];
};

/**
 * Номера WhatsApp Business, доступные этому входу. Идём по цепочке Meta: бизнес-портфели →
 * аккаунты WhatsApp Business → номера. Если портфелей не видно (у части аккаунтов так), спрашиваем
 * аккаунты WhatsApp Business напрямую — так подключение работает и без Business Manager.
 */
export async function discoverWhatsAppNumbers(userToken: string): Promise<WaNumber[]> {
    const wabas: string[] = [];
    for (const b of await list<{ id: string }>("/me/businesses?limit=50", userToken)) {
        for (const w of await list<{ id: string }>(`/${b.id}/owned_whatsapp_business_accounts?limit=50`, userToken)) wabas.push(w.id);
    }
    if (!wabas.length) for (const w of await list<{ id: string }>("/me/whatsapp_business_accounts?limit=50", userToken)) wabas.push(w.id);

    const out: WaNumber[] = [];
    for (const wabaId of wabas) {
        for (const n of await list<{ id: string; display_phone_number?: string; verified_name?: string }>(`/${wabaId}/phone_numbers?limit=50`, userToken)) {
            out.push({ wabaId, phoneNumberId: n.id, display: n.display_phone_number ?? n.id, verifiedName: n.verified_name ?? "" });
        }
    }
    return out;
}

/**
 * Код из окна Embedded Signup меняем на «бизнес-токен» клиента (business integration system user
 * access token) — им дальше подписываем его аккаунт WhatsApp на наше приложение и отправляем сообщения.
 * Код живёт 30 секунд, поэтому обмен делаем сразу, как только он пришёл с клиента.
 */
export async function exchangeEmbeddedCode(appId: string, appSecret: string, code: string): Promise<string> {
    const q = new URLSearchParams({ client_id: appId, client_secret: appSecret, code });
    const res = await fetchProvider(`${base()}/oauth/access_token?${q}`, { method: "GET" });
    const json = (await res.json().catch(() => null)) as { access_token?: string; error?: { message?: string } } | null;
    if (!res.ok || !json?.access_token) throw new ProviderError(json?.error?.message ?? "Meta отклонила код подключения — попробуйте ещё раз");
    return json.access_token;
}

// Реквизиты номера: заодно проверяем, что id номера и токен доступа подходят друг другу
export const getPhoneNumber = (phoneNumberId: string, accessToken: string) =>
    graph<{ id: string; display_phone_number?: string; verified_name?: string }>(`/${phoneNumberId}?fields=display_phone_number,verified_name`, accessToken);

// Приложение подписывается на аккаунт WhatsApp Business: без этой подписки Meta не присылает вебхуки
export const subscribeApp = (wabaId: string, accessToken: string) =>
    graph<{ success?: boolean }>(`/${wabaId}/subscribed_apps`, accessToken, { method: "POST" });

/**
 * Адрес вебхука и маркер подтверждения для WhatsApp — тот же шаг, что и у Messenger: в кабинете Meta
 * рядом стоят поля для ссылки на страницу CRM и для произвольной строки, и в них легко вписать не то.
 * Meta принимает значения и через API (токеном «app-id|app-secret»), сама проверяя адрес.
 */
export async function setWhatsAppAppWebhook(appId: string, appSecret: string, callbackUrl: string, verifyToken: string) {
    const token = `${appId}|${appSecret}`;
    const q = new URLSearchParams({ object: "whatsapp_business_account", callback_url: callbackUrl, verify_token: verifyToken, fields: "messages", access_token: token });
    await graphRaw<{ success?: boolean }>(`/${appId}/subscriptions?${q}`, { method: "POST" });
}

export async function sendWhatsApp(accessToken: string, phoneNumberId: string, to: string, text: string) {
    const res = await graph<{ messages?: { id?: string }[] }>(`/${phoneNumberId}/messages`, accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to,
            type: "text",
            text: { preview_url: false, body: text },
        }),
    });
    return res.messages?.[0]?.id ?? "";
}

// Meta подписывает вебхуки WhatsApp так же, как Messenger: X-Hub-Signature-256 = HMAC-SHA256(тело, App secret)
export const verifyWhatsAppSignature = verifyMetaSignature;

// Проверка адреса при настройке вебхука в кабинете Meta: отвечаем hub.challenge, если совпал verify token
export function verifyWhatsAppChallenge(query: URLSearchParams, verifyToken: string) {
    if (query.get("hub.mode") !== "subscribe") return null;
    if (!safeEqual(query.get("hub.verify_token") ?? "", verifyToken)) return null;
    return query.get("hub.challenge") ?? "";
}

interface WaMedia { caption?: string; filename?: string; id?: string; mime_type?: string }

interface WaMessage {
    id?: string;
    from?: string;
    timestamp?: string;
    type?: string;
    text?: { body?: string };
    button?: { text?: string };
    interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
    image?: WaMedia;
    video?: WaMedia;
    document?: WaMedia;
    audio?: WaMedia;
    voice?: WaMedia;
    sticker?: WaMedia;
}

interface WaChange {
    field?: string;
    value?: {
        // номер, которому адресовано событие: по нему находится фирма (адрес вебхука один на приложение)
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: WaMessage[];
        statuses?: { id?: string; status?: string; errors?: { title?: string; message?: string }[] }[];
    };
}

// Вложение показываем меткой вроде «[photo]»: сам файл лежит в WhatsApp и забирается отдельным запросом по media id
const MEDIA_LABEL: Record<string, string> = {
    image: "[photo]",
    video: "[video]",
    document: "[file]",
    audio: "[voice]",
    voice: "[voice]",
    sticker: "[sticker]",
    location: "[location]",
    contacts: "[contact]",
};

// Текст входящего: подпись к вложению важнее метки, а служебные типы (реакция, системное) остаются меткой
function incomingText(m: WaMessage) {
    if (m.text?.body) return m.text.body;
    if (m.button?.text) return m.button.text;
    if (m.interactive?.button_reply?.title) return m.interactive.button_reply.title;
    if (m.interactive?.list_reply?.title) return m.interactive.list_reply.title;
    const caption = m.image?.caption ?? m.video?.caption ?? m.document?.caption;
    if (caption) return caption;
    const type = m.type ?? "";
    return MEDIA_LABEL[type] ?? (type ? `[${type}]` : "[message]");
}

// События вебхука: входящие сообщения и отчёты о доставке наших сообщений (Meta присылает и то, и другое сюда)
export interface WaIncoming { externalId: string; name?: string; text: string; messageId?: string }
export interface WaStatus { id: string; status: string; error: string }

/** События вебхука, разложенные по номеру, которому они адресованы: Meta кладёт phone_number_id
 *  в каждое изменение, и по нему находится фирма — это надёжнее адреса вебхука, который один на приложение. */
export function parseWhatsAppWebhookByNumber(body: WaBody) {
    const out = new Map<string, { messages: WaIncoming[]; statuses: WaStatus[] }>();
    if (body.object !== "whatsapp_business_account") return out;
    for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
            if (change.field !== "messages" || !change.value) continue;
            const value = change.value;
            const phoneNumberId = String(value.metadata?.phone_number_id ?? "");
            const group = out.get(phoneNumberId) ?? { messages: [], statuses: [] };
            // имя собеседника Meta присылает один раз, в том же событии, где пришло сообщение
            const names = new Map((value.contacts ?? []).map((c) => [c.wa_id ?? "", c.profile?.name ?? ""]));
            for (const m of value.messages ?? []) {
                if (!m.from) continue;
                group.messages.push({ externalId: m.from, name: names.get(m.from) || m.from, text: incomingText(m), messageId: m.id });
            }
            for (const st of value.statuses ?? []) {
                if (!st.id) continue;
                group.statuses.push({ id: st.id, status: st.status ?? "", error: st.errors?.[0]?.title ?? st.errors?.[0]?.message ?? "" });
            }
            out.set(phoneNumberId, group);
        }
    }
    return out;
}

type WaBody = { object?: string; entry?: { changes?: WaChange[] }[] };

export function parseWhatsAppWebhook(body: WaBody) {
    const messages: WaIncoming[] = [];
    const statuses: WaStatus[] = [];
    parseWhatsAppWebhookByNumber(body).forEach((group) => {
        messages.push(...group.messages);
        statuses.push(...group.statuses);
    });
    return { messages, statuses };
}

/** Куда приложение Meta сейчас шлёт события WhatsApp: адрес один на приложение, поэтому его мог
 *  переписать другой кабинет — по этому списку видно, наш там адрес или чужой. */
export async function appSubscriptions(appId: string, appSecret: string) {
    const token = `${appId}|${appSecret}`;
    const res = await graphRaw<{ data?: { object?: string; callback_url?: string; active?: boolean }[] }>(
        `/${appId}/subscriptions?access_token=${encodeURIComponent(token)}`
    );
    return (res.data ?? []).filter((s) => s.object === "whatsapp_business_account");
}
