import { fetchProvider, ProviderError } from "@/lib/http";
import { mediaKind, type MediaRef } from "./media";

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

// Тот же вызов, но тело — multipart: так Telegram принимает файлы
async function callForm<T>(botToken: string, method: string, form: FormData): Promise<T> {
    const res = await fetchProvider(`${base()}/bot${botToken}/${method}`, { method: "POST", body: form }, 60000);
    const json = (await res.json().catch(() => null)) as { ok: boolean; result: T; description?: string } | null;
    if (!json?.ok) throw new ProviderError(json?.description ?? `Telegram error ${res.status}`);
    return json.result;
}

export const getMe = (botToken: string) => call<{ id: number; username: string; first_name: string }>(botToken, "getMe");

export const setWebhook = (botToken: string, url: string, secret: string) =>
    call<boolean>(botToken, "setWebhook", { url, secret_token: secret, allowed_updates: ["message"] });

export const deleteWebhook = (botToken: string) => call<boolean>(botToken, "deleteWebhook");

export const getWebhookInfo = (botToken: string) =>
    call<{ url: string; pending_update_count: number; last_error_message?: string }>(botToken, "getWebhookInfo");

// Режим без вебхука (сайт на localhost или без публичного https): CRM сама забирает новые сообщения бота
export const getUpdates = (botToken: string, offset: number) =>
    call<{ update_id: number; message?: Parameters<typeof parseTelegramUpdate>[0]["message"] }[]>(botToken, "getUpdates", {
        offset,
        limit: 50,
        timeout: 0,
        allowed_updates: ["message"],
    });


export async function sendTelegram(botToken: string, chatId: string, text: string) {
    const msg = await call<{ message_id: number }>(botToken, "sendMessage", { chat_id: chatId, text });
    return String(msg.message_id);
}

// Отправка файла: сам файл уходит в Telegram телом запроса (multipart), поэтому публичная ссылка не нужна.
// Фото и голосовые Telegram принимает только «своими» способами, всё остальное — документом.
export async function sendTelegramMedia(
    botToken: string,
    chatId: string,
    media: { kind: string; name: string; mime: string },
    data: Buffer,
    caption = ""
) {
    const voice = media.kind === "voice" && /^(audio\/ogg|audio\/opus)/i.test(media.mime);
    const method = media.kind === "image" ? "sendPhoto" : voice ? "sendVoice" : "sendDocument";
    const field = method === "sendPhoto" ? "photo" : method === "sendVoice" ? "voice" : "document";
    const form = new FormData();
    form.append("chat_id", chatId);
    if (caption) form.append("caption", caption.slice(0, 1024));
    form.append(field, new Blob([data], { type: media.mime || "application/octet-stream" }), media.name);
    const msg = await callForm<{ message_id: number }>(botToken, method, form);
    return String(msg.message_id);
}

// Скачивание файла, который прислал собеседник: getFile даёт путь, сам файл отдаётся по /file/bot<токен>/<путь>
export async function downloadTelegramFile(botToken: string, fileId: string) {
    const file = await call<{ file_path?: string; file_size?: number }>(botToken, "getFile", { file_id: fileId });
    if (!file.file_path) return null;
    const res = await fetchProvider(`${base()}/file/bot${botToken}/${file.file_path}`, {}, 30000);
    if (!res.ok) throw new ProviderError(`Telegram did not return the file (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
}

interface TgFile { file_id: string; file_size?: number; file_name?: string; mime_type?: string }
interface TgMessage {
    message_id: number;
    chat: { id: number; type: string; title?: string; first_name?: string; last_name?: string; username?: string };
    text?: string;
    caption?: string;
    photo?: TgFile[];
    document?: TgFile;
    voice?: TgFile;
    audio?: TgFile;
    video?: TgFile;
    sticker?: unknown;
    location?: unknown;
    contact?: unknown;
}

// Вложение сообщения: у фото берём самый крупный размер, у остальных — сам файл
function attachmentOf(m: TgMessage): MediaRef | undefined {
    const photo = m.photo?.[m.photo.length - 1];
    if (photo) return { kind: "image", name: "photo.jpg", mime: "image/jpeg", size: photo.file_size, fileId: photo.file_id };
    const file = m.voice ?? m.audio ?? m.video ?? m.document;
    if (!file) return undefined;
    const mime = file.mime_type || (m.voice ? "audio/ogg" : m.video ? "video/mp4" : "application/octet-stream");
    const fallback = m.voice ? "voice.ogg" : m.video ? "video.mp4" : "file";
    return { kind: mediaKind(mime, file.file_name ?? fallback), name: file.file_name || fallback, mime, size: file.file_size, fileId: file.file_id };
}

// Update из вебхука → обычное входящее сообщение (только личные чаты). Вложения забирает recordMessage.
export function parseTelegramUpdate(update: { update_id?: number; message?: TgMessage }) {
    const m = update.message;
    if (!m || m.chat.type !== "private") return null;
    const name = [m.chat.first_name, m.chat.last_name].filter(Boolean).join(" ") || m.chat.username || `Telegram ${m.chat.id}`;
    const media = attachmentOf(m);
    // подпись вида [sticker]/[location] остаётся только у того, что скачать нельзя
    const label = m.sticker ? "[sticker]" : m.location ? "[location]" : m.contact ? "[contact]" : "";
    return {
        externalId: String(m.chat.id),
        name,
        text: m.text ?? m.caption ?? (media ? "" : label),
        media,
        messageId: `${m.chat.id}:${m.message_id}`,
    };
}
