import { isPlatformAdminUser } from "@/lib/admin";
import { fetchProvider, ProviderError } from "@/lib/http";
import { refreshTokens, type Tokens } from "@/lib/mail/oauth";
import { ensurePlatformEnv, platformEnvCached } from "@/lib/platformEnv";
import { prisma } from "@/lib/prisma";
import { saveYoutubeState, youtubeState } from "./config";
import {
    normalizePrivacy,
    normalizeTags,
    publicAllowed,
    titleFromText,
    YOUTUBE_SCOPES,
    type PrivacyStatus,
} from "./types";

// YouTube Data API: загрузка видео через resumable upload (videos.insert).
//
// Квота YouTube считается не в запросах, а в units и выделяется на проект Google Cloud:
//   • videos.insert — 1600 units за одно видео;
//   • channels.list / videos.list — 1 unit;
//   • стандартная дневная квота — 10 000 units, то есть примерно 6 загрузок в день.
// Исчерпанная квота — это HTTP 403 с reason quotaExceeded, а не 429: повторять запрос бессмысленно
// до следующего дня (квота сбрасывается в полночь по тихоокеанскому времени). Увеличить лимит можно
// только заявкой в YouTube API Services — она рассматривается вручную, поэтому в интерфейсе показываем
// остаток в «видео в день», а не обещаем безлимит.
//
// Важное ограничение: у неверифицированных проектов (audit не пройден) все видео, загруженные через
// videos.insert, принудительно остаются private — даже если запросить unlisted. Код возвращает
// фактический privacyStatus из ответа YouTube, поэтому интерфейс покажет, что вышло на самом деле.
// Это описано в docs/SOCIAL_PUBLISHING.md.

const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/youtube/v3/videos";

export const YOUTUBE_QUOTA = {
    unitsPerUpload: 1600,
    dailyUnits: 10_000,
    uploadsPerDay: 6,
};

/** Ограничение памяти сервера, а не YouTube: файл читается в Buffer перед отправкой. */
export const YOUTUBE_MAX_BYTES = 512 * 1024 * 1024;

interface GoogleErrorBody {
    error?: {
        code?: number;
        message?: string;
        status?: string;
        errors?: Array<{ reason?: string; message?: string }>;
    };
}

function googleErrorMessage(json: GoogleErrorBody | null, status: number): string {
    const reason = json?.error?.errors?.[0]?.reason ?? "";
    const message = json?.error?.message ?? "";
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
        return `YouTube quota is exhausted (${YOUTUBE_QUOTA.dailyUnits} units per day, one upload costs ${YOUTUBE_QUOTA.unitsPerUpload}). It resets at midnight Pacific Time.`;
    }
    if (reason === "uploadLimitExceeded") {
        return "YouTube rejected the upload: the channel has reached its upload limit for today";
    }
    if (reason === "youtubeSignupRequired") {
        return "This Google account has no YouTube channel. Create a channel first, then connect again.";
    }
    if (reason === "accessNotConfigured" || /has not been used in project|is disabled/i.test(message)) {
        return `YouTube Data API is not enabled in the Google Cloud project. ${message}`.trim();
    }
    return `YouTube: ${message || `HTTP ${status}`}`;
}

const errorText = (e: unknown) => (e instanceof Error && e.message ? e.message : "Unknown error");

/** Настроена ли пара Google OAuth-ключей (та же, что у почты, Drive и рекламы). */
export const youtubeConfigured = () => !!(platformEnvCached("GOOGLE_CLIENT_ID") && platformEnvCached("GOOGLE_CLIENT_SECRET"));

export const youtubeMissing = (): string[] => {
    const missing: string[] = [];
    if (!platformEnvCached("GOOGLE_CLIENT_ID")) missing.push("GOOGLE_CLIENT_ID");
    if (!platformEnvCached("GOOGLE_CLIENT_SECRET")) missing.push("GOOGLE_CLIENT_SECRET");
    return missing;
};

export interface YoutubeStatus {
    configured: boolean;
    connected: boolean;
    channelId: string;
    channelTitle: string;
    connectedAt: string;
    status: string;
    error: string;
    /** Куда Google возвращает пользователя: общий колбэк почты уже зарегистрирован в Google Cloud. */
    redirectPath: string;
    scopes: string;
    missing: string[];
    quota: typeof YOUTUBE_QUOTA;
}

export async function youtubeStatus(): Promise<YoutubeStatus> {
    await ensurePlatformEnv();
    const state = await youtubeState();
    return {
        configured: youtubeConfigured(),
        connected: !!state.refreshToken && state.status !== "error",
        channelId: state.channelId,
        channelTitle: state.channelTitle,
        connectedAt: state.connectedAt,
        status: state.status,
        error: state.error,
        redirectPath: "/api/mail/oauth/callback",
        scopes: YOUTUBE_SCOPES,
        missing: youtubeMissing(),
        quota: YOUTUBE_QUOTA,
    };
}

async function assertPlatformOwner(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, platformAdmin: true } });
    if (!(await isPlatformAdminUser(user))) throw new ProviderError("Only the owner of the platform can connect YouTube publishing");
}

/** Канал, к которому относится токен: channels.list?mine=true. Нужен и для имени в настройках, и для проверки прав. */
export async function youtubeChannel(accessToken: string): Promise<{ id: string; title: string }> {
    const res = await fetchProvider(`${API}/channels?part=snippet&mine=true&maxResults=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    }, 20000);
    const json = (await res.json().catch(() => null)) as (GoogleErrorBody & { items?: Array<{ id?: string; snippet?: { title?: string } }> }) | null;
    if (!res.ok || json?.error) throw new ProviderError(googleErrorMessage(json, res.status));
    const item = json?.items?.[0];
    if (!item?.id) throw new ProviderError("This Google account has no YouTube channel to publish to");
    return { id: item.id, title: item.snippet?.title ?? "" };
}

/** Сохраняет подключение YouTube. Токены — только в зашифрованном secrets, как у почты и рекламы. */
export async function connectYoutube(userId: string, tokens: Tokens): Promise<void> {
    await assertPlatformOwner(userId);
    if (!tokens.refreshToken) {
        throw new ProviderError("Google did not allow offline access. Remove the app in your Google account permissions and connect YouTube again.");
    }
    const channel = await youtubeChannel(tokens.accessToken);
    await saveYoutubeState(
        {
            channelId: channel.id,
            channelTitle: channel.title,
            connectedAt: new Date().toISOString(),
            status: "connected",
            error: "",
            scope: tokens.scope ?? "",
        },
        {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
            scope: tokens.scope ?? "",
        }
    );
}

export async function disconnectYoutube(): Promise<void> {
    await saveYoutubeState(
        { channelId: "", channelTitle: "", connectedAt: "", status: "", error: "", scope: "" },
        { accessToken: "", refreshToken: "", expiresAt: 0, scope: "" }
    );
}

/** Действующий access token; при истечении обновляет его по refresh-токену и сохраняет новый. */
export async function youtubeAccessToken(): Promise<string> {
    await ensurePlatformEnv();
    const state = await youtubeState();
    if (state.accessToken && state.expiresAt > Date.now() + 60_000) return state.accessToken;
    if (!state.refreshToken) throw new ProviderError("YouTube is not connected: connect it in Settings → Integrations");
    try {
        const fresh = await refreshTokens("google", state.refreshToken);
        await saveYoutubeState(
            { status: "connected", error: "", scope: fresh.scope || state.scope },
            {
                accessToken: fresh.accessToken,
                // Google не всегда присылает refresh_token заново — сохраняем прежний
                refreshToken: fresh.refreshToken || state.refreshToken,
                expiresAt: fresh.expiresAt,
                scope: fresh.scope || state.scope,
            }
        );
        return fresh.accessToken;
    } catch (e) {
        const message = "YouTube access was revoked. Connect it again in Settings → Integrations.";
        await saveYoutubeState({ status: "error", error: message }).catch(() => undefined);
        throw new ProviderError(`${message} ${errorText(e)}`.trim());
    }
}

export interface YoutubeUploadInput {
    accessToken: string;
    bytes: Buffer;
    mime: string;
    title: string;
    description: string;
    tags: string[];
    privacyStatus: PrivacyStatus;
    /** Явное подтверждение владельца: без него public не отправляется. */
    confirmPublic?: boolean;
}

export interface YoutubeUploadResult {
    videoId: string;
    url: string;
    privacyStatus: PrivacyStatus;
}

export function youtubeMetadata(input: { title?: string; description?: string; tags?: string[]; privacyStatus?: unknown; confirmPublic?: unknown }) {
    const description = String(input.description ?? "").slice(0, 5000);
    const title = (String(input.title ?? "").trim() || titleFromText(description) || "Firmspace video").slice(0, 100);
    const privacyStatus = normalizePrivacy(input.privacyStatus);
    if (!publicAllowed(privacyStatus, input.confirmPublic)) {
        throw new ProviderError("YouTube public publishing needs explicit confirmation from the owner (privacyStatus=public + confirmPublic=true)");
    }
    return {
        title,
        description,
        tags: normalizeTags(input.tags, 500),
        privacyStatus,
    };
}

/** Загрузка MP4 на YouTube: resumable upload в один PUT (файл уже в памяти сервера). */
export async function uploadYoutubeVideo(input: YoutubeUploadInput): Promise<YoutubeUploadResult> {
    const meta = youtubeMetadata(input);
    if (!input.bytes.length) throw new ProviderError("Video file is empty");
    if (input.bytes.length > YOUTUBE_MAX_BYTES) {
        throw new ProviderError(`Video is too large: ${Math.round(input.bytes.length / 1024 / 1024)} MB (max ${YOUTUBE_MAX_BYTES / 1024 / 1024} MB by the server memory limit)`);
    }

    const initBody = {
        snippet: {
            title: meta.title,
            description: meta.description,
            tags: meta.tags,
            categoryId: "22", // People & Blogs — безопасный выбор для корпоративного канала
        },
        status: {
            privacyStatus: meta.privacyStatus,
            selfDeclaredMadeForKids: false,
            embeddable: true,
        },
    };
    const init = await fetchProvider(`${UPLOAD_API}?uploadType=resumable&part=snippet,status`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${input.accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": input.mime,
            "X-Upload-Content-Length": String(input.bytes.length),
        },
        body: JSON.stringify(initBody),
    }, 30000);
    if (!init.ok) {
        const json = (await init.json().catch(() => null)) as GoogleErrorBody | null;
        throw new ProviderError(googleErrorMessage(json, init.status));
    }
    const location = init.headers.get("location");
    if (!location) throw new ProviderError("YouTube did not return an upload URL");

    const upload = await fetchProvider(location, {
        method: "PUT",
        headers: {
            "Content-Type": input.mime,
            "Content-Length": String(input.bytes.length),
        },
        body: new Uint8Array(input.bytes),
    }, 180_000);
    const json = (await upload.json().catch(() => null)) as
        | (GoogleErrorBody & { id?: string; status?: { privacyStatus?: string } })
        | null;
    if (!upload.ok || json?.error || !json?.id) {
        throw new ProviderError(googleErrorMessage(json, upload.status));
    }
    const actual = normalizePrivacy(json.status?.privacyStatus);
    return {
        videoId: json.id,
        url: `https://youtu.be/${json.id}`,
        privacyStatus: actual,
    };
}
