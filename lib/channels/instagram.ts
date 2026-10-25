import { fetchProvider, ProviderError } from "@/lib/http";
import { graphBase } from "@/lib/meta";

// Instagram Direct ходит в тот же Graph API, что Messenger и WhatsApp: версия и адрес задаются
// в одном месте (lib/meta), чтобы смена версии не оставляла один канал на снятой версии.

/** Запрос к Graph API от имени страницы, к которой привязан аккаунт Instagram */
async function graph<T extends object>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetchProvider(`${graphBase()}${path}${sep}access_token=${encodeURIComponent(accessToken)}`, init);
    const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string; code?: number } }) | null;
    if (!res.ok || !json || json.error) {
        const message = json?.error?.message ?? `Instagram error ${res.status}`;
        // Отвечать в Instagram можно только в течение 24 часов после последнего сообщения человека:
        // Meta отвечает на это невнятным отказом, а оператору нужно знать причину, а не код ошибки.
        const outsideWindow = json?.error?.code === 10 || /outside.*(window|24)|24 hours|messaging window/i.test(message);
        const hint = outsideWindow ? " — Instagram allows a reply only within 24 hours after the customer's last message" : "";
        throw new ProviderError(`${message}${hint}`);
    }
    return json;
}

// В Instagram Direct собеседник — это IGSID (идентификатор пользователя внутри аккаунта Instagram),
// а не username: отправляем ответ на него, как Messenger на PSID.
export async function sendInstagram(pageAccessToken: string, igsid: string, text: string) {
    const res = await graph<{ message_id?: string; recipient_id?: string }>("/me/messages", pageAccessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: igsid }, message: { text } }),
    });
    return res.message_id ?? "";
}

// Username в Instagram отдаётся не всегда (и только при праве instagram_basic) — тогда остаётся заглушка
export async function instagramUserName(pageAccessToken: string, igsid: string) {
    try {
        const u = await graph<{ username?: string; name?: string }>(`/${encodeURIComponent(igsid)}?fields=username,name`, pageAccessToken);
        return u.username || u.name || "";
    } catch {
        return "";
    }
}

interface InstagramEvent {
    sender?: { id: string };
    recipient?: { id: string };
    message?: { mid: string; text?: string; is_echo?: boolean; is_deleted?: boolean; attachments?: { type: string }[] };
}

// Событие вебхука Instagram: object=instagram, entry[].messaging[] — та же форма, что у страницы
// Messenger, но собеседник в sender.id. Эхо (is_echo) — это наши же исходящие: записывать их
// вторым сообщением не нужно, они уже записаны в момент отправки.
export function parseInstagramBody(body: { object?: string; entry?: { messaging?: InstagramEvent[] }[] }) {
    if (body.object !== "instagram") return [];
    const events: { externalId: string; text: string; direction: "in"; messageId: string }[] = [];
    for (const entry of body.entry ?? []) {
        for (const ev of entry.messaging ?? []) {
            if (!ev.sender?.id || !ev.message || ev.message.is_echo) continue;
            const attachment = ev.message.attachments?.[0]?.type;
            events.push({
                externalId: ev.sender.id,
                text: ev.message.text ?? (attachment ? `[${attachment}]` : "[message]"),
                direction: "in",
                messageId: ev.message.mid,
            });
        }
    }
    return events;
}
