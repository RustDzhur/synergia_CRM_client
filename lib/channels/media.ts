import { createHmac } from "crypto";
import { randomToken, safeEqual } from "@/lib/crypto";
import { fetchProvider } from "@/lib/http";
import { secretsOf } from "@/lib/integrations";
import { deleteObject, putObject, storageConfigured } from "@/lib/storage";
import { downloadTelegramFile } from "./telegram";
import { webmOpusToOgg } from "./oggOpus";

type Doc = any;

// Вложения в переписке (фото, файлы, голосовые). Файл забирается у провайдера во входящем сообщении
// или приходит из CRM в исходящем и лежит в том же хранилище, что и документы фирмы.
export type MediaKind = "image" | "file" | "voice";

// Telegram отдаёт ботам файлы не больше 20 МБ; столько же принимаем и от Viber
export const MAX_MEDIA_MB = 20;
export const MAX_MEDIA_BYTES = MAX_MEDIA_MB * 1024 * 1024;

// Предел размера запроса у функций Vercel — 4,5 МБ, поэтому из браузера принимаем файл не больше 4 МБ
export const MAX_ATTACH_MB = 4;
export const MAX_ATTACH_BYTES = MAX_ATTACH_MB * 1024 * 1024;

// Ссылка на вложение у провайдера: Telegram отдаёт файл по file_id, Viber — по прямой ссылке
export interface MediaRef {
    kind: MediaKind;
    name: string;
    mime: string;
    size?: number;
    fileId?: string;
    url?: string;
}

// Вложение, уже лежащее в хранилище фирмы
export interface StoredMedia {
    kind: MediaKind;
    name: string;
    mime: string;
    size: number;
    path: string;
}

// Исходящее: файл уже сохранён (нужен путь для Viber — он принимает только ссылку), байты — для Telegram
export interface OutgoingMedia {
    attachment: StoredMedia;
    data: Buffer;
    origin: string;
}

const AUDIO_EXT = /\.(ogg|oga|opus|m4a|mp3|wav|aac|amr|flac)$/i;

// Вид вложения по типу файла: картинку показываем в переписке, звук — проигрывателем, остальное — карточкой файла
export function mediaKind(mime: string, name = ""): MediaKind {
    const m = (mime || "").toLowerCase();
    if (m.startsWith("image/") && !m.includes("svg")) return "image";
    if (m.startsWith("audio/") || AUDIO_EXT.test(name)) return "voice";
    return "file";
}

// Имя файла для хранилища: без служебных символов и без пути
export function mediaName(name: string, fallback = "file") {
    const clean = (name || "").replace(/[\p{Cc}<>\\/:*?"|]/gu, "_").replace(/^\.+/, "").trim().slice(0, 120);
    return clean || fallback;
}

// Подпись для списка бесед и уведомления, когда у вложения нет текста: значок понятен на любом языке
export function mediaLabel(media?: { kind: string; name?: string } | null) {
    if (!media) return "";
    if (media.kind === "image") return "📷";
    if (media.kind === "voice") return "🎤";
    return `📄 ${media.name ?? ""}`.trim();
}

// Кладём вложение в хранилище фирмы. null — хранилище не настроено или файл не подошёл: сообщение всё равно сохраняем.
export async function saveMedia(owner: string, ref: { kind: MediaKind; name: string; mime: string }, data: Buffer): Promise<StoredMedia | null> {
    if (!storageConfigured() || data.length === 0 || data.length > MAX_MEDIA_BYTES) return null;
    const name = mediaName(ref.name);
    const path = `messages/${owner}/${randomToken(8)}/${name}`;
    const mime = ref.mime || "application/octet-stream";
    await putObject(path, data, mime);
    return { kind: ref.kind, name, mime, size: data.length, path };
}

export async function dropMedia(path: string) {
    await deleteObject(path).catch(() => undefined);
}

// Голосовое из браузера приходит в WebM, а Telegram принимает голосовые только как OGG/Opus,
// MP3 или M4A. Перекладываем контейнер прямо перед отправкой: в хранилище и в переписке
// остаётся исходный файл (браузер его и так проигрывает), а в Telegram уходит Ogg/Opus.
// Не получилось — отправляем как раньше, документом: голосовое важнее не потерять.
export function telegramMedia(media: OutgoingMedia): OutgoingMedia {
    const { attachment } = media;
    if (attachment.kind !== "voice") return media; // настоящее видео конвертировать нельзя
    const mime = (attachment.mime || "").split(";")[0].trim().toLowerCase();
    if (mime !== "audio/webm" && mime !== "video/webm") return media;
    try {
        const data = webmOpusToOgg(media.data);
        return { ...media, data, attachment: { ...attachment, mime: "audio/ogg", name: attachment.name.replace(/\.[a-z0-9]+$/i, "") + ".ogg", size: data.length } };
    } catch {
        return media;
    }
}

// Забираем входящее вложение у провайдера и сохраняем. Ошибка не должна мешать самому сообщению.
export async function fetchMedia(owner: string, integration: Doc, ref: MediaRef): Promise<StoredMedia | null> {
    if (!storageConfigured()) return null;
    try {
        let data: Buffer | null = null;
        if (ref.fileId && integration.type === "telegram") data = await downloadTelegramFile(secretsOf(integration).botToken, ref.fileId);
        else if (ref.url) {
            const res = await fetchProvider(ref.url, {}, 30000);
            if (!res.ok) return null;
            data = Buffer.from(await res.arrayBuffer());
        } else return null;
        if (!data) return null;
        return await saveMedia(owner, ref, data);
    } catch {
        return null; // файл недоступен или хранилище отказало — в переписке останется только подпись
    }
}

// Провайдеры не всегда сообщают тип файла (Viber присылает только имя) — определяем по расширению
const MIME_BY_EXT: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic",
    pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", opus: "audio/opus", wav: "audio/wav", aac: "audio/aac", amr: "audio/amr",
    mp4: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo", zip: "application/zip", rar: "application/vnd.rar",
    txt: "text/plain", csv: "text/csv", json: "application/json",
};

export function mimeByName(name: string) {
    const ext = (name || "").split(".").pop()?.toLowerCase() ?? "";
    return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

// Размер файла вложения человеческим языком (в переписке рядом с названием)
export function mediaSize(bytes: number) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Провайдеры (Viber) принимают вложение только по ссылке: отдаём подписанную временную ссылку на файл.
// Подпись — тот же ключ, что и у остальных секретов; срок жизни небольшой, ссылка нужна провайдеру на один запрос.
const mediaSecret = () => process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "";
const sign = (payload: string) => createHmac("sha256", mediaSecret()).update(payload).digest("hex");

export function mediaToken(path: string, ttlSec = 3600) {
    const payload = `${Math.floor(Date.now() / 1000) + ttlSec}.${Buffer.from(path, "utf8").toString("base64url")}`;
    return `${payload}.${sign(payload)}`;
}

export function readMediaToken(token: string): string | null {
    const parts = (token || "").split(".");
    if (parts.length !== 3) return null;
    const payload = `${parts[0]}.${parts[1]}`;
    if (!safeEqual(sign(payload), parts[2])) return null;
    if (Number(parts[0]) * 1000 < Date.now()) return null;
    return Buffer.from(parts[1], "base64url").toString("utf8");
}

export const mediaUrl = (origin: string, path: string) => `${origin.replace(/\/+$/, "")}/api/media/${mediaToken(path)}`;
