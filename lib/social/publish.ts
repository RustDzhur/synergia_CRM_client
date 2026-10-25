import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fetchProvider, ProviderError } from "@/lib/http";
import { graphBase } from "@/lib/meta";
import { socialTarget } from "./config";

// Публикация поста (текст + картинка) на страницу Facebook и дублирование в Instagram.
// Facebook: POST /<page>/photos — файл уходит multipart-ом, поэтому картинка не обязана быть
// доступной из интернета. Instagram: POST /<ig>/media (image_url + caption) и media_publish.
// Адрес картинки для Instagram берём из самого Facebook-поста (full_picture), как и оговорено:
// так в обеих сетях гарантированно один и тот же кадр, а нам не нужен публичный адрес сайта.
// Ошибка Instagram не отменяет уже вышедший пост в Facebook: возвращаем fbUrl и текст igError.

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // предел Instagram для image_url
const IG_CAPTION_MAX = 2200;
const FB_TEXT_MAX = 5000;

export interface PublishInput {
    text: string;
    imagePath: string;
}

export interface PublishResult {
    fbPostId: string;
    fbUrl: string;
    igMediaId: string;
    igUrl: string;
    /** Instagram не принял пост (Facebook уже опубликован) — показываем причину, не считаем всю публикацию сбойной. */
    igError?: string;
}

interface GraphError { error?: { message?: string; code?: number; error_subcode?: number } }

const mimeOf = (file: string) => {
    const ext = path.extname(file).toLowerCase();
    if (ext === ".png") return "image/png";
    if (ext === ".webp") return "image/webp";
    if (ext === ".gif") return "image/gif";
    return "image/jpeg";
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

export async function publishPost(input: PublishInput): Promise<PublishResult> {
    const text = String(input.text ?? "").trim();
    if (!text) throw new ProviderError("Post text is required");
    if (text.length > FB_TEXT_MAX) throw new ProviderError(`Post text is too long: ${text.length} characters (max ${FB_TEXT_MAX})`);
    const target = await socialTarget();
    const image = await readPublicImage(input.imagePath);

    const fb = await postToFacebook(text, image, target.pageId, target.pageToken);

    let igMediaId = "";
    let igUrl = "";
    let igError: string | undefined;
    try {
        const ig = await postToInstagram(text, fb.imageUrl, target.igUserId, target.pageToken);
        igMediaId = ig.mediaId;
        igUrl = ig.url;
    } catch (e) {
        igError = e instanceof Error ? e.message : "Instagram publishing failed";
    }
    return { fbPostId: fb.postId, fbUrl: fb.fbUrl, igMediaId, igUrl, ...(igError ? { igError } : {}) };
}
