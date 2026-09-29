import { createHmac } from "crypto";
import { fetchProvider, ProviderError } from "@/lib/http";
import { safeEqual } from "@/lib/crypto";
import { type MediaRef, mediaKind, mimeByName } from "./media";

const base = () => (process.env.VIBER_API_URL || "https://chatapi.viber.com/pa").replace(/\/+$/, "");

async function call<T extends { status: number; status_message?: string }>(authToken: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
    const res = await fetchProvider(`${base()}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Viber-Auth-Token": authToken },
        body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as T | null;
    if (!json || json.status !== 0) throw new ProviderError(json?.status_message ?? `Viber error ${res.status}`);
    return json;
}

export const getAccount = (authToken: string) => call<{ status: number; name: string; uri?: string }>(authToken, "get_account_info");

export const setViberWebhook = (authToken: string, url: string) =>
    call(authToken, "set_webhook", { url, event_types: ["message", "unsubscribed"], send_name: true });

export const removeViberWebhook = (authToken: string) => call(authToken, "set_webhook", { url: "" });

export async function sendViber(authToken: string, botName: string, receiver: string, text: string) {
    const res = await call<{ status: number; message_token?: number }>(authToken, "send_message", {
        receiver,
        min_api_version: 1,
        sender: { name: botName.slice(0, 28) || "CRM" },
        type: "text",
        text,
    });
    return String(res.message_token ?? "");
}

// Viber принимает вложение только ссылкой на файл в интернете (media), поэтому отдаём ему подписанную
// временную ссылку на файл из хранилища фирмы. Обложкой (text) подпись поддерживает только картинка,
// поэтому у файлов подпись уходит отдельным сообщением следом.
export async function sendViberMedia(
    authToken: string,
    botName: string,
    receiver: string,
    media: { kind: string; name: string; mime: string; size: number },
    url: string,
    caption = ""
) {
    const picture = media.kind === "image";
    const body: Record<string, unknown> = {
        receiver,
        min_api_version: 1,
        sender: { name: botName.slice(0, 28) || "CRM" },
        type: picture ? "picture" : "file",
        media: url,
    };
    if (picture) {
        if (caption) body.text = caption.slice(0, 768);
    } else {
        body.file_name = media.name;
        body.size = media.size;
    }
    const res = await call<{ status: number; message_token?: number }>(authToken, "send_message", body);
    const token = String(res.message_token ?? "");
    if (!picture && caption) await sendViber(authToken, botName, receiver, caption.slice(0, 7000));
    return token;
}

// Viber подписывает тело запроса: hex HMAC-SHA256 с токеном бота в заголовке X-Viber-Content-Signature
export function verifyViberSignature(rawBody: string, signature: string | null, authToken: string) {
    if (!signature) return false;
    return safeEqual(createHmac("sha256", authToken).update(rawBody).digest("hex"), signature);
}

interface ViberMessage {
    type: string;
    text?: string;
    media?: string;
    file_name?: string;
    size?: number;
    duration?: number;
    sticker_id?: number;
    lat?: number;
    lon?: number;
}

export function parseViberEvent(body: {
    event?: string;
    message_token?: number;
    sender?: { id: string; name?: string };
    message?: ViberMessage;
}) {
    if (body.event !== "message" || !body.sender?.id || !body.message) return null;
    const m = body.message;
    // у картинки тип файла неизвестен — Viber отдаёт её как jpeg; у файла смотрим на расширение
    const mime = m.type === "picture" ? "image/jpeg" : mimeByName(m.file_name ?? "");
    const media: MediaRef | undefined = m.media
        ? {
            kind: mediaKind(mime, m.file_name ?? ""),
            name: m.file_name || (m.type === "picture" ? "photo.jpg" : "file"),
            mime,
            size: m.size,
            url: m.media,
        }
        : undefined;
    const label = m.type === "sticker" ? "[sticker]" : m.type === "location" ? "[location]" : m.type === "contact" ? "[contact]" : m.type === "url" ? (m.text ?? "") : "";
    return {
        externalId: body.sender.id,
        name: body.sender.name || "Viber",
        text: m.type === "text" ? m.text ?? "" : m.text ?? (media ? "" : label),
        media,
        messageId: body.message_token ? String(body.message_token) : undefined,
    };
}
