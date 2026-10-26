// Общие типы публикации в соцсети платформы: Facebook, Instagram, YouTube и TikTok.
// Площадки перечислены в одном месте, потому что от этого списка зависят и очередь Social Poster,
// и HTTP-маршрут публикации, и карточки настроек. Токены и ключи приложений здесь не живут:
// они читаются из platformsettings (lib/social/config.ts) и хранятся зашифрованными.

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "youtube", "tiktok"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** Площадки, которые принимают видеофайл. Facebook/Instagram в первом этапе публикуют картинки. */
export const VIDEO_PLATFORMS: readonly SocialPlatform[] = ["youtube", "tiktok"];

export type SocialMediaType = "image" | "video";
export type PrivacyStatus = "private" | "unlisted" | "public";
export type TikTokMode = "inbox" | "direct";

// Права YouTube Data API. youtube.upload — загрузка видео (1600 units за videos.insert),
// youtube.readonly — список своих каналов, чтобы показать, куда подключились. Без второго права
// нельзя даже проверить канал, поэтому запрашиваем оба сразу.
export const YOUTUBE_SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";

// Content Posting API: video.upload — загрузка в черновики (inbox), video.publish — прямая публикация.
// user.info.basic нужен, чтобы показать имя автора и open_id в настройках.
export const TIKTOK_DEFAULT_SCOPES = "user.info.basic,video.upload,video.publish";

export const isSocialPlatform = (value: unknown): value is SocialPlatform =>
    typeof value === "string" && (SOCIAL_PLATFORMS as readonly string[]).includes(value);

export const normalizeMediaType = (value: unknown): SocialMediaType => (value === "video" ? "video" : "image");

/** Что публикует пост, если цели не заданы: картинка — в Meta, видео — в YouTube/TikTok. */
export const defaultTargets = (mediaType: SocialMediaType): SocialPlatform[] =>
    mediaType === "video" ? ["youtube", "tiktok"] : ["facebook", "instagram"];

/**
 * Список целей из флага запроса. Принимает массив или строку через запятую, отбрасывает неизвестное
 * и повторы. Пустой список — цели по умолчанию для этого типа медиа. Так старый вызов
 * publishPost({ text, imagePath }) продолжает работать без указания targets.
 */
export function normalizeTargets(value: unknown, mediaType: SocialMediaType): SocialPlatform[] {
    const raw = Array.isArray(value)
        ? value
        : typeof value === "string"
          ? value.split(",")
          : [];
    const seen = new Set<SocialPlatform>();
    const list: SocialPlatform[] = [];
    for (const item of raw) {
        const name = typeof item === "string" ? item.trim().toLowerCase() : "";
        if (isSocialPlatform(name) && !seen.has(name)) {
            seen.add(name);
            list.push(name);
        }
    }
    return list.length ? list : defaultTargets(mediaType);
}

export const normalizePrivacy = (value: unknown): PrivacyStatus =>
    value === "public" || value === "unlisted" ? value : "private";

/** Публичная публикация разрешена только при явном подтверждении владельца (флаг confirmPublic). */
export const publicAllowed = (privacy: PrivacyStatus, confirmPublic: unknown) => privacy !== "public" || confirmPublic === true;

/** Первая непустая строка текста — заголовок видео, если отдельный title не задан. */
export function titleFromText(text: string, max = 100): string {
    const line = String(text ?? "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find(Boolean) ?? "";
    return line.slice(0, max);
}

/** Хештеги поста как метки YouTube. Суммарная длина меток у YouTube — не больше 500 символов. */
export function tagsFromText(text: string, maxTotal = 500): string[] {
    const out: string[] = [];
    let total = 0;
    const matches = String(text ?? "").match(/#[^\s#.,!?;:()\[\]{}"'«»]+/g) ?? [];
    for (const match of matches) {
        const tag = match.replace(/^#+/, "").trim();
        if (!tag || tag.length > 40) continue;
        if (out.some((t) => t.toLowerCase() === tag.toLowerCase())) continue;
        // запятая в метке разделила бы её на две: такие метки пропускаем
        if (tag.includes(",")) continue;
        if (total + tag.length + 1 > maxTotal) break;
        out.push(tag);
        total += tag.length + 1;
    }
    return out;
}

/** Нормализация меток из запроса: массив или строка через запятую, без пустых и повторов. */
export function normalizeTags(value: unknown, maxTotal = 500): string[] {
    const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
    const out: string[] = [];
    let total = 0;
    for (const item of raw) {
        if (typeof item !== "string") continue;
        const tag = item.trim().replace(/^#+/, "").replace(/,/g, " ");
        if (!tag || tag.length > 40) continue;
        if (out.some((t) => t.toLowerCase() === tag.toLowerCase())) continue;
        if (total + tag.length + 1 > maxTotal) break;
        out.push(tag);
        total += tag.length + 1;
    }
    return out;
}

export const normalizeTikTokMode = (value: unknown): TikTokMode => (value === "direct" ? "direct" : "inbox");
