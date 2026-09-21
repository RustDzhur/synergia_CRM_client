import { createHmac } from "crypto";
import { fetchProvider, ProviderError } from "@/lib/http";
import { safeEqual } from "@/lib/crypto";

const base = () => (process.env.GRAPH_API_URL || "https://graph.facebook.com/v19.0").replace(/\/+$/, "");

async function graph<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetchProvider(`${base()}${path}${sep}access_token=${encodeURIComponent(accessToken)}`, init);
    const json = (await res.json().catch(() => null)) as (T & { error?: { message: string } }) | null;
    if (!res.ok || !json || json.error) throw new ProviderError(json?.error?.message ?? `Facebook error ${res.status}`);
    return json;
}

export const getPage = (accessToken: string) => graph<{ id: string; name: string }>("/me?fields=id,name", accessToken);

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
