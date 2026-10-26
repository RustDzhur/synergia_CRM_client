import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fetchProvider, ProviderError } from "@/lib/http";
import { graphBase } from "@/lib/meta";
import { socialTarget } from "./config";
import { tiktokAccessToken, tiktokAppConfig, uploadTikTokVideo } from "./tiktok";
import {
    normalizeMediaType,
    normalizePrivacy,
    normalizeTags,
    normalizeTargets,
    tagsFromText,
    titleFromText,
    type PrivacyStatus,
    type SocialMediaType,
    type SocialPlatform,
} from "./types";
import { uploadYoutubeVideo, youtubeAccessToken } from "./youtube";

// Публикация поста платформы в список целей {facebook, instagram, youtube, tiktok}.
// Facebook: POST /<page>/photos — файл уходит multipart-ом, поэтому картинка не обязана быть
// доступной из интернета. Instagram: POST /<ig>/media (image_url + caption) и media_publish.
// Адрес картинки для Instagram берём из самого Facebook-поста (full_picture): так в обеих сетях
// гарантированно один и тот же кадр, а нам не нужен публичный адрес сайта. Instagram в этом этапе
// зависит от Facebook: если Facebook не вышел, картинку для Instagram взять неоткуда.
//
// Видео (mediaType=video) уходит в YouTube (resumable videos.insert) и TikTok (Content Posting API).
// Facebook/Instagram видео в первом этапе не принимают — это честно фиксируется в ошибке цели, а не
// молча пропускается. Каждая цель публикуется независимо: сбой одной не отменяет остальные.

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // предел Instagram для image_url
export const MAX_VIDEO_BYTES = 512 * 1024 * 1024; // предел памяти сервера при чтении файла
const IG_CAPTION_MAX = 2200;
const FB_TEXT_MAX = 5000;

export interface PublishInput {
    text: string;
    imagePath?: string;
    /** Путь к MP4/MOV внутри public/; нужен целям youtube и tiktok. */
    videoPath?: string;
    mediaType?: SocialMediaType | string;
    /** Список целей; пусто — facebook+instagram для картинки и youtube+tiktok для видео. */
    targets?: SocialPlatform[] | string;
    /** Заголовок YouTube/TikTok; пусто — первая строка текста. */
    title?: string;
    /** Описание YouTube; пусто — text. */
    description?: string;
    tags?: string[] | string;
    /** private (по умолчанию) | unlisted | public. */
    privacyStatus?: PrivacyStatus | string;
    /** Явное подтверждение владельца для public. */
    confirmPublic?: boolean;
    /** Проверка без сети: возвращает фиктивные id, ничего не публикует. */
    mock?: boolean;
}

export interface PublishResult {
    fbPostId: string;
    fbUrl: string;
    igMediaId: string;
    igUrl: string;
    /** Instagram не принял пост (Facebook уже опубликован) — причина видна, но публикация не сбойная. */
    igError?: string;
    youtubeVideoId: string;
    youtubeUrl: string;
    /** Фактический статус YouTube: у неверифицированного проекта Google видео может остаться private. */
    youtubePrivacy?: string;
    tiktokPublishId: string;
    tiktokUrl: string;
    tiktokStatus?: string;
    /** Ошибки отдельных целей: пост считается вышедшим, если хотя бы одна цель ответила успехом. */
    errors: Partial<Record<SocialPlatform, string>>;
    /** true — это mock-ответ, во внешние сервисы ничего не отправлялось. */
    mock?: boolean;
}

interface GraphError { error?: { message?: string; code?: number; error_subcode?: number } }

const mimeOf = (file: string) => {
    const ext = path.extname(file).toLowerCase();
    if (ext === ".png") return "image/png";
    if (ext === ".webp") return "image/webp";
    if (ext === ".gif") return "image/gif";
    return "image/jpeg";
};

const videoMimeOf = (file: string) => {
    const ext = path.extname(file).toLowerCase();
    if (ext === ".mov") return "video/quicktime";
    if (ext === ".webm") return "video/webm";
    if (ext === ".m4v") return "video/x-m4v";
    return "video/mp4";
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const messageOf = (e: unknown) => (e instanceof Error && e.message ? e.message : "Publishing failed");

async function graphJson<T>(url: string, init: RequestInit = {}, timeoutMs = 30000): Promise<T> {
    const res = await fetchProvider(url, init, timeoutMs);
    const json = (await res.json().catch(() => null)) as (T & GraphError) | null;
    if (!res.ok || !json || json.error) {
        const message = json?.error?.message ?? `Meta API answered HTTP ${res.status}`;
        throw new ProviderError(`Meta: ${message}`);
    }
    return json;
}

/** Картинка лежит в public/ (в контейнере каталог скопирован из репозитория). Читаем файл, а не URL: так публикация не зависит от сети сайта. */
export async function readPublicImage(imagePath: string): Promise<{ file: string; bytes: Buffer; mime: string }> {
    const raw = typeof imagePath === "string" ? imagePath.trim() : "";
    if (!raw) throw new ProviderError("No image for the post: give a path inside public/ (for example public/brand/cover.png)");
    const publicDir = path.resolve(process.cwd(), "public");
    const candidate = raw.replace(/^\/+/, "").startsWith("public/")
        ? path.resolve(process.cwd(), raw.replace(/^\/+/, ""))
        : path.resolve(publicDir, raw.replace(/^\/+/, ""));
    if (candidate !== publicDir && !candidate.startsWith(`${publicDir}${path.sep}`)) {
        throw new ProviderError("The image must be a file inside public/");
    }
    const info = await stat(candidate).catch(() => null);
    if (!info?.isFile()) throw new ProviderError(`Image not found: ${raw}`);
    if (info.size > MAX_IMAGE_BYTES) throw new ProviderError(`Image is too large for Instagram: ${Math.round(info.size / 1024 / 1024)} MB (max 8 MB)`);
    const bytes = await readFile(candidate);
    return { file: candidate, bytes, mime: mimeOf(candidate) };
}

/** Видео для YouTube/TikTok: тот же принцип, что у картинки — только файл внутри public/. */
export async function readPublicVideo(videoPath: string): Promise<{ file: string; bytes: Buffer; mime: string; size: number }> {
    const raw = typeof videoPath === "string" ? videoPath.trim() : "";
    if (!raw) throw new ProviderError("No video for the post: give a path inside public/ (for example public/social/launch.mp4)");
    const publicDir = path.resolve(process.cwd(), "public");
    const candidate = raw.replace(/^\/+/, "").startsWith("public/")
        ? path.resolve(process.cwd(), raw.replace(/^\/+/, ""))
        : path.resolve(publicDir, raw.replace(/^\/+/, ""));
    if (candidate !== publicDir && !candidate.startsWith(`${publicDir}${path.sep}`)) {
        throw new ProviderError("The video must be a file inside public/");
    }
    if (![".mp4", ".mov", ".m4v", ".webm"].includes(path.extname(candidate).toLowerCase())) {
        throw new ProviderError("Video must be MP4, MOV or WebM");
    }
    const info = await stat(candidate).catch(() => null);
    if (!info?.isFile()) throw new ProviderError(`Video not found: ${raw}`);
    if (info.size > MAX_VIDEO_BYTES) throw new ProviderError(`Video is too large: ${Math.round(info.size / 1024 / 1024)} MB (max ${MAX_VIDEO_BYTES / 1024 / 1024} MB)`);
    const bytes = await readFile(candidate);
    return { file: candidate, bytes, mime: videoMimeOf(candidate), size: info.size };
}

/** Пост в Facebook: фото + подпись. Возвращает id поста и адрес записи. */
async function postToFacebook(text: string, image: { file: string; bytes: Buffer; mime: string }, pageId: string, pageToken: string) {
    const form = new FormData();
    form.append("message", text);
    form.append("published", "true");
    form.append("access_token", pageToken);
    form.append("source", new Blob([new Uint8Array(image.bytes)], { type: image.mime }), path.basename(image.file));
    const created = await graphJson<{ id?: string; post_id?: string }>(`${graphBase()}/${encodeURIComponent(pageId)}/photos`, { method: "POST", body: form });
    const postId = String(created.post_id || created.id || "");
    if (!postId) throw new ProviderError("Facebook accepted the photo but returned no post id");
    // permalink_url — человеческая ссылка на запись; full_picture — публичный адрес кадра для Instagram
    const fields = await graphJson<{ permalink_url?: string; full_picture?: string }>(
        `${graphBase()}/${encodeURIComponent(postId)}?fields=permalink_url,full_picture&access_token=${encodeURIComponent(pageToken)}`
    );
    let imageUrl = String(fields.full_picture || "");
    if (!imageUrl && created.id) {
        // у фото-поста кадр надёжнее брать с самого объекта фото
        const photo = await graphJson<{ images?: Array<{ source?: string }> }>(
            `${graphBase()}/${encodeURIComponent(String(created.id))}?fields=images&access_token=${encodeURIComponent(pageToken)}`
        ).catch(() => ({ images: [] as Array<{ source?: string }> }));
        imageUrl = String(photo.images?.[0]?.source || "");
    }
    if (!imageUrl) throw new ProviderError("Facebook published the photo but did not return an image URL for Instagram");
    const fbUrl = String(fields.permalink_url || `https://www.facebook.com/${postId}`);
    return { postId, fbUrl, imageUrl };
}

/** Контейнер Instagram иногда не готов сразу: повторяем публикацию, пока Meta не ответит «готово». */
async function publishInstagramContainer(igUserId: string, creationId: string, pageToken: string): Promise<{ id: string }> {
    const body = new URLSearchParams({ creation_id: creationId, access_token: pageToken });
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            return await graphJson<{ id: string }>(`${graphBase()}/${encodeURIComponent(igUserId)}/media_publish`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString(),
            });
        } catch (e) {
            const message = e instanceof Error ? e.message : "";
            if (attempt === 3 || !/not available|not ready|processing|try again/i.test(message)) throw e;
            await sleep(2000 * (attempt + 1));
        }
    }
    throw new ProviderError("Instagram did not publish the post in time");
}

async function postToInstagram(text: string, imageUrl: string, igUserId: string, pageToken: string): Promise<{ mediaId: string; url: string }> {
    const container = await graphJson<{ id: string }>(`${graphBase()}/${encodeURIComponent(igUserId)}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ image_url: imageUrl, caption: text.slice(0, IG_CAPTION_MAX), access_token: pageToken }).toString(),
    });
    const creationId = String(container.id || "");
    if (!creationId) throw new ProviderError("Instagram did not create a media container");
    const published = await publishInstagramContainer(igUserId, creationId, pageToken);
    const mediaId = String(published.id || "");
    let url = "";
    if (mediaId) {
        const media = await graphJson<{ permalink?: string }>(
            `${graphBase()}/${encodeURIComponent(mediaId)}?fields=permalink&access_token=${encodeURIComponent(pageToken)}`
        ).catch(() => ({ permalink: "" }));
        url = String(media.permalink || "");
    }
    return { mediaId, url };
}

function emptyResult(): PublishResult {
    return {
        fbPostId: "",
        fbUrl: "",
        igMediaId: "",
        igUrl: "",
        youtubeVideoId: "",
        youtubeUrl: "",
        tiktokPublishId: "",
        tiktokUrl: "",
        errors: {},
    };
}

/** Проверка без внешних сервисов: ничего не публикует, возвращает предсказуемые фиктивные id. */
function mockResult(targets: SocialPlatform[]): PublishResult {
    const result = emptyResult();
    const stamp = Date.now().toString(36);
    for (const target of targets) {
        if (target === "facebook") {
            result.fbPostId = `mock-fb-${stamp}`;
            result.fbUrl = `https://www.facebook.com/${result.fbPostId}`;
        } else if (target === "instagram") {
            result.igMediaId = `mock-ig-${stamp}`;
            result.igUrl = `https://www.instagram.com/p/${result.igMediaId}`;
        } else if (target === "youtube") {
            result.youtubeVideoId = `mock-yt-${stamp}`;
            result.youtubeUrl = `https://youtu.be/${result.youtubeVideoId}`;
            result.youtubePrivacy = "private";
        } else if (target === "tiktok") {
            result.tiktokPublishId = `mock-tt-${stamp}`;
            result.tiktokUrl = "";
            result.tiktokStatus = "mock";
        }
    }
    return { ...result, mock: true };
}

export async function publishPost(input: PublishInput): Promise<PublishResult> {
    const text = String(input.text ?? "").trim();
    if (!text) throw new ProviderError("Post text is required");
    if (text.length > FB_TEXT_MAX) throw new ProviderError(`Post text is too long: ${text.length} characters (max ${FB_TEXT_MAX})`);
    const mediaType = normalizeMediaType(input.mediaType ?? (input.videoPath ? "video" : "image"));
    const targets = normalizeTargets(input.targets, mediaType);
    if (input.mock) return mockResult(targets);

    const description = String(input.description ?? text);
    const title = String(input.title ?? "").trim() || titleFromText(text);
    // TikTok принимает подпись до 2200 знаков: если отдельного заголовка нет, отдаём весь текст поста.
    const tiktokTitle = String(input.title ?? "").trim() || text;
    const tags = input.tags === undefined ? tagsFromText(text) : normalizeTags(input.tags, 500);
    const privacyStatus = normalizePrivacy(input.privacyStatus);
    const errors: Partial<Record<SocialPlatform, string>> = {};
    const result = emptyResult();
    let succeeded = false;

    const wantsFacebook = targets.includes("facebook");
    const wantsInstagram = targets.includes("instagram");
    const wantsImage = wantsFacebook || wantsInstagram;
    const wantsVideo = targets.includes("youtube") || targets.includes("tiktok");

    // ── Facebook + Instagram ─────────────────────────────────────────────────────────────────────────────
    let image: { file: string; bytes: Buffer; mime: string } | null = null;
    if (wantsImage) {
        try {
            image = await readPublicImage(input.imagePath ?? "");
        } catch (e) {
            const message = messageOf(e);
            if (wantsFacebook) errors.facebook = message;
            if (wantsInstagram) errors.instagram = message;
        }
    }
    let fbImageUrl = "";
    if (wantsFacebook && image) {
        try {
            const target = await socialTarget();
            const fb = await postToFacebook(text, image, target.pageId, target.pageToken);
            result.fbPostId = fb.postId;
            result.fbUrl = fb.fbUrl;
            fbImageUrl = fb.imageUrl;
            succeeded = true;
        } catch (e) {
            errors.facebook = messageOf(e);
        }
    }
    if (wantsInstagram && !errors.instagram) {
        if (!wantsFacebook) {
            // Instagram Graph API принимает image_url, а не файл: в этом этапе источник кадра — Facebook-пост.
            errors.instagram = "Instagram publishing needs facebook in targets: the image URL comes from the Facebook post";
        } else if (!fbImageUrl) {
            errors.instagram = errors.facebook ? "Facebook publishing failed, so Instagram has no image URL" : "No image URL from Facebook for Instagram";
        } else {
            try {
                const target = await socialTarget();
                const ig = await postToInstagram(text, fbImageUrl, target.igUserId, target.pageToken);
                result.igMediaId = ig.mediaId;
                result.igUrl = ig.url;
                succeeded = true;
            } catch (e) {
                errors.instagram = messageOf(e);
            }
        }
    }
    if (result.igUrl || errors.instagram) result.igError = errors.instagram;

    // ── YouTube ───────────────────────────────────────────────────────────────────────────────────────────
    if (targets.includes("youtube")) {
        if (mediaType !== "video") {
            errors.youtube = "YouTube publishing requires mediaType=video and a video path";
        } else {
            try {
                const video = await readPublicVideo(input.videoPath ?? "");
                const token = await youtubeAccessToken();
                const uploaded = await uploadYoutubeVideo({
                    accessToken: token,
                    bytes: video.bytes,
                    mime: video.mime,
                    title,
                    description,
                    tags,
                    privacyStatus,
                    confirmPublic: input.confirmPublic === true,
                });
                result.youtubeVideoId = uploaded.videoId;
                result.youtubeUrl = uploaded.url;
                result.youtubePrivacy = uploaded.privacyStatus;
                succeeded = true;
            } catch (e) {
                errors.youtube = messageOf(e);
            }
        }
    }

    // ── TikTok ────────────────────────────────────────────────────────────────────────────────────────────
    if (targets.includes("tiktok")) {
        if (mediaType !== "video") {
            errors.tiktok = "TikTok publishing requires mediaType=video and a video path";
        } else {
            try {
                const cfg = await tiktokAppConfig();
                const token = await tiktokAccessToken();
                const video = await readPublicVideo(input.videoPath ?? "");
                const uploaded = await uploadTikTokVideo({
                    accessToken: token,
                    bytes: video.bytes,
                    title: tiktokTitle,
                    mode: cfg.mode,
                    privacyStatus,
                    confirmPublic: input.confirmPublic === true,
                    displayName: cfg.displayName,
                });
                result.tiktokPublishId = uploaded.publishId;
                result.tiktokUrl = uploaded.url;
                result.tiktokStatus = uploaded.status;
                succeeded = true;
            } catch (e) {
                errors.tiktok = messageOf(e);
            }
        }
    }

    // Ни одна цель не ответила успехом — это сбой публикации, а не «частичный успех».
    if (!succeeded) {
        if (!wantsImage && !wantsVideo) throw new ProviderError("No publishing targets: choose facebook, instagram, youtube or tiktok");
        const summary = (Object.entries(errors) as Array<[string, string]>)
            .map(([target, message]) => `${target}: ${message}`)
            .join("; ");
        throw new ProviderError(summary || "No publishing target succeeded");
    }
    result.errors = errors;
    return result;
}
