import { fetchProvider, ProviderError } from "@/lib/http";

// TELEGRAM_API_URL нужен для собственного Bot API сервера и для локальных проверок без настоящего бота
const base = () => (process.env.TELEGRAM_API_URL || "https://api.telegram.org").replace(/\/+$/, "");

async function call<T>(botToken: string, method: string, body?: Record<string, unknown>): Promise<T> {
    const res = await fetchProvider(`${base()}/bot${botToken}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; result: T; description?: string } | null;
    if (!json?.ok) throw new ProviderError(json?.description ?? `Telegram error ${res.status}`);
    return json.result;
}

export const getMe = (botToken: string) => call<{ id: number; username: string; first_name: string }>(botToken, "getMe");

export const setWebhook = (botToken: string, url: string, secret: string) =>
    call<boolean>(botToken, "setWebhook", { url, secret_token: secret, allowed_updates: ["message"] });

export const deleteWebhook = (botToken: string) => call<boolean>(botToken, "deleteWebhook");

export async function sendTelegram(botToken: string, chatId: string, text: string) {
    const msg = await call<{ message_id: number }>(botToken, "sendMessage", { chat_id: chatId, text });
    return String(msg.message_id);
}

interface TgMessage {
    message_id: number;
    chat: { id: number; type: string; title?: string; first_name?: string; last_name?: string; username?: string };
    text?: string;
    caption?: string;
    photo?: unknown;
    document?: unknown;
    voice?: unknown;
    sticker?: unknown;
}

// Update из вебхука → обычное входящее сообщение (только личные чаты; вложения показываем как метку)
export function parseTelegramUpdate(update: { update_id?: number; message?: TgMessage }) {
    const m = update.message;
    if (!m || m.chat.type !== "private") return null;
    const name = [m.chat.first_name, m.chat.last_name].filter(Boolean).join(" ") || m.chat.username || `Telegram ${m.chat.id}`;
    const attachment = m.photo ? "[photo]" : m.document ? "[file]" : m.voice ? "[voice]" : m.sticker ? "[sticker]" : "[message]";
    return {
        externalId: String(m.chat.id),
        name,
        text: m.text ?? m.caption ?? attachment,
        messageId: `${m.chat.id}:${m.message_id}`,
    };
}
