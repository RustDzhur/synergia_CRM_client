import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { isPlatformAdminUser } from "@/lib/admin";
import { fetchProvider, ProviderError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { saveTiktokState, tiktokState } from "./config";
import {
    normalizePrivacy,
    normalizeTikTokMode,
    publicAllowed,
    TIKTOK_DEFAULT_SCOPES,
    titleFromText,
    type PrivacyStatus,
    type TikTokMode,
} from "./types";

// TikTok Content Posting API (OAuth 2.0 + PKCE).
//
// Что нужно от владельца платформы (подробно — в docs/SOCIAL_PUBLISHING.md):
//   1) приложение в TikTok for Developers (https://developers.tiktok.com/);
//   2) продукты Login Kit и Content Posting API, scopes user.info.basic, video.upload, video.publish;
//   3) Redirect URI ровно https://firmspace.de/api/social/tiktok/callback (без косой черты в конце);
//   4) приложение отправлено на review. До review TikTok разрешает только SELF_ONLY/черновики и
//      ограниченный круг тестовых аккаунтов, поэтому режим по умолчанию — inbox (черновик), а не public.
//
// Два режима Content Posting API:
//   • inbox  — POST /v2/post/publish/inbox/video/init/ + загрузка: видео падает в черновики автора,
//              человек сам дописывает и публикует его в приложении TikTok. Нужен scope video.upload.
//   • direct — POST /v2/post/publish/video/init/: публикация сразу. Нужен scope video.publish.
//              Приватность по умолчанию SELF_ONLY; PUBLIC_TO_EVERYONE — только при явном подтверждении.
//
// Загрузка файла — FILE_UPLOAD: init возвращает upload_url на час, файл уходит кусками (Content-Range).
// Правила TikTok: кусок не меньше 5 МБ и не больше 64 МБ (последний — до 128 МБ), кадры идут строго
// по порядку, total_chunk_count = floor(video_size / chunk_size). Округление вверх даёт лишний
// крошечный кусок и 416 RequestedRangeNotSatisfiable — поэтому считаем именно floor.

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const API = "https://open.tiktokapis.com/v2";

const MB = 1024 * 1024;
export const TIKTOK_MAX_BYTES = 4 * 1024 * MB; // ограничение TikTok: 4 ГБ
export const TIKTOK_MAX_TITLE = 2200; // UTF-16 code units
/** Ограничение памяти сервера: файл читается в Buffer перед отправкой. */
export const TIKTOK_SERVER_MAX_BYTES = 512 * MB;

const base64url = (buf: Buffer) =>
    buf
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

/** PKCE: verifier живёт только в httpOnly-cookie нашего домена, в state его не кладём. */
export function createPkce(): { verifier: string; challenge: string } {
    const verifier = base64url(randomBytes(32));
    const challenge = base64url(createHash("sha256").update(verifier).digest());
    return { verifier, challenge };
}

export function makeTikTokState(userId: string, locale: string): string {
    return jwt.sign({ sub: userId, l: locale, p: "tiktok" }, process.env.JWT_SECRET as string, { expiresIn: "10m" });
}

export function readTikTokState(state: string): { sub: string; l: string } | null {
    try {
        const payload = jwt.verify(state, process.env.JWT_SECRET as string) as { sub?: string; l?: string; p?: string };
        if (payload.p !== "tiktok" || !payload.sub) return null;
        return { sub: payload.sub, l: payload.l ?? "de" };
    } catch {
        return null;
    }
}

export interface TikTokAppConfig {
    clientKey: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string;
    mode: TikTokMode;
    openId: string;
    displayName: string;
    connectedAt: string;
    status: string;
    error: string;
    scope: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    refreshExpiresAt: number;
}

/**
 * Настройки приложения и подключения. Источник — platformsettings/tiktok (как требует архитектура);
 * переменные окружения TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REDIRECT_URI — только
 * запасной путь для локальной проверки, база важнее.
 */
export async function tiktokAppConfig(): Promise<TikTokAppConfig> {
    const state = await tiktokState();
    return {
        ...state,
        clientKey: state.clientKey || (process.env.TIKTOK_CLIENT_KEY ?? "").trim(),
        clientSecret: state.clientSecret || (process.env.TIKTOK_CLIENT_SECRET ?? "").trim(),
        redirectUri: state.redirectUri || (process.env.TIKTOK_REDIRECT_URI ?? "").trim() || "https://firmspace.de/api/social/tiktok/callback",
        scopes: state.scopes || (process.env.TIKTOK_SCOPES ?? "").trim() || TIKTOK_DEFAULT_SCOPES,
        mode: normalizeTikTokMode(state.mode),
    };
}

export const tiktokConfigured = async (): Promise<boolean> => {
    const cfg = await tiktokAppConfig();
    return !!(cfg.clientKey && cfg.clientSecret);
};

export const tiktokMissing = (cfg: TikTokAppConfig): string[] => {
    const missing: string[] = [];
    if (!cfg.clientKey) missing.push("TIKTOK_CLIENT_KEY");
    if (!cfg.clientSecret) missing.push("TIKTOK_CLIENT_SECRET");
    return missing;
};

export interface TikTokStatus {
    configured: boolean;
    connected: boolean;
    clientKey: string;
    displayName: string;
    openId: string;
    connectedAt: string;
    status: string;
    error: string;
    redirectUri: string;
    scopes: string;
    mode: TikTokMode;
    missing: string[];
    maxVideoBytes: number;
    reviewRequired: boolean;
}

export async function tiktokStatus(): Promise<TikTokStatus> {
    const cfg = await tiktokAppConfig();
    return {
        configured: !!(cfg.clientKey && cfg.clientSecret),
        connected: !!cfg.refreshToken && cfg.status !== "error",
        clientKey: cfg.clientKey,
        displayName: cfg.displayName,
        openId: cfg.openId,
        connectedAt: cfg.connectedAt,
        status: cfg.status,
        error: cfg.error,
        redirectUri: cfg.redirectUri,
        scopes: cfg.scopes,
        mode: cfg.mode,
        missing: tiktokMissing(cfg),
        maxVideoBytes: TIKTOK_MAX_BYTES,
        reviewRequired: true,
    };
}

async function assertPlatformOwner(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, platformAdmin: true } });
    if (!(await isPlatformAdminUser(user))) throw new ProviderError("Only the owner of the platform can connect TikTok publishing");
}

/** Сохраняет client_key/client_secret из настроек. Пустой секрет оставляет прежний (его не показываем). */
export async function saveTiktokApp(input: {
    clientKey?: string;
    clientSecret?: string;
    redirectUri?: string;
    scopes?: string;
    mode?: string;
}): Promise<void> {
    const current = await tiktokState();
    const clientKey = String(input.clientKey ?? "").trim() || current.clientKey || (process.env.TIKTOK_CLIENT_KEY ?? "").trim();
    const clientSecret = String(input.clientSecret ?? "").trim() || current.clientSecret || (process.env.TIKTOK_CLIENT_SECRET ?? "").trim();
    if (!clientKey) throw new ProviderError("TikTok client key is required");
    if (!clientSecret) throw new ProviderError("TikTok client secret is required");
    const redirectUri = String(input.redirectUri ?? "").trim() || current.redirectUri || "https://firmspace.de/api/social/tiktok/callback";
    const scopes = String(input.scopes ?? "").trim() || current.scopes || TIKTOK_DEFAULT_SCOPES;
    const mode = input.mode === undefined ? normalizeTikTokMode(current.mode) : normalizeTikTokMode(input.mode);
    await saveTiktokState({ clientKey, redirectUri, scopes, mode }, { clientSecret });
}

/** Отключение: токены стираем, ключи приложения оставляем — переподключение в один клик. */
export async function disconnectTiktok(): Promise<void> {
    await saveTiktokState(
        { openId: "", displayName: "", connectedAt: "", status: "", error: "", scope: "" },
        { accessToken: "", refreshToken: "", expiresAt: 0, refreshExpiresAt: 0, scope: "" }
    );
}

export function tiktokAuthorizeUrl(input: {
    clientKey: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    scopes: string;
}): string {
    const scopes = input.scopes
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(",");
    const q = new URLSearchParams({
        client_key: input.clientKey,
        response_type: "code",
        scope: scopes,
        redirect_uri: input.redirectUri,
        state: input.state,
        code_challenge: input.codeChallenge,
        code_challenge_method: "S256",
    });
    return `${AUTH_URL}?${q.toString()}`;
}

interface TokenResponse {
    data?: TokenPayload;
    access_token?: string;
    expires_in?: number;
    open_id?: string;
    refresh_token?: string;
    refresh_expires_in?: number;
    scope?: string;
    error?: string | { code?: string; message?: string };
    error_description?: string;
}

interface TokenPayload {
    access_token?: string;
    expires_in?: number;
    open_id?: string;
    refresh_token?: string;
    refresh_expires_in?: number;
    scope?: string;
}

const tokenError = (json: TokenResponse | null, status: number): string => {
    const err = json?.error;
    const code = typeof err === "string" ? err : err?.code ?? "";
    const message = typeof err === "string" ? json?.error_description ?? err : err?.message ?? "";
    if (code === "invalid_grant") return "TikTok rejected the authorization code (it may have expired). Start the connection again.";
    return `TikTok authorization failed: ${message || code || `HTTP ${status}`}`;
};

async function tokenRequest(form: Record<string, string>): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    refreshExpiresAt: number;
    openId: string;
    scope: string;
}> {
    const res = await fetchProvider(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(form).toString(),
    }, 20000);
    const json = (await res.json().catch(() => null)) as TokenResponse | null;
    const data = (json?.data && typeof json.data === "object" ? json.data : json) as TokenPayload | null;
    if (!res.ok || !data?.access_token) throw new ProviderError(tokenError(json, res.status));
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? "",
        expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
        refreshExpiresAt: Date.now() + (Number(data.refresh_expires_in) || 365 * 24 * 3600) * 1000,
        openId: data.open_id ?? "",
        scope: data.scope ?? "",
    };
}

export async function exchangeTikTokCode(input: {
    clientKey: string;
    clientSecret: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
}) {
    return tokenRequest({
        client_key: input.clientKey,
        client_secret: input.clientSecret,
        code: input.code,
        grant_type: "authorization_code",
        redirect_uri: input.redirectUri,
        code_verifier: input.codeVerifier,
    });
}

export async function refreshTikTokTokens(input: { clientKey: string; clientSecret: string; refreshToken: string }) {
    return tokenRequest({
        client_key: input.clientKey,
        client_secret: input.clientSecret,
        grant_type: "refresh_token",
        refresh_token: input.refreshToken,
    });
}

/** Обмен кода завершён: сохраняем профиль и токены в platformsettings/tiktok. */
export async function connectTiktok(
    userId: string,
    tokens: { accessToken: string; refreshToken: string; expiresAt: number; refreshExpiresAt: number; openId: string; scope: string }
): Promise<void> {
    await assertPlatformOwner(userId);
    if (!tokens.refreshToken) throw new ProviderError("TikTok did not return a refresh token. Start the connection again.");
    const user = await tiktokUserInfo(tokens.accessToken).catch(() => null);
    await saveTiktokState(
        {
            openId: tokens.openId || user?.openId || "",
            displayName: user?.displayName ?? "",
            connectedAt: new Date().toISOString(),
            status: "connected",
            error: "",
            scope: tokens.scope,
        },
        {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
            refreshExpiresAt: tokens.refreshExpiresAt,
            scope: tokens.scope,
        }
    );
}

/** Действующий access token TikTok; refresh-токен TikTok живёт около года и вращается при обновлении. */
export async function tiktokAccessToken(): Promise<string> {
    const cfg = await tiktokAppConfig();
    if (cfg.accessToken && cfg.expiresAt > Date.now() + 60_000) return cfg.accessToken;
    if (!cfg.refreshToken) throw new ProviderError("TikTok is not connected: connect it in Settings → Integrations");
    if (!cfg.clientKey || !cfg.clientSecret) throw new ProviderError("TikTok client key/secret are not configured");
    if (cfg.refreshExpiresAt && cfg.refreshExpiresAt < Date.now()) {
        throw new ProviderError("TikTok refresh token has expired. Connect TikTok again in Settings → Integrations.");
    }
    try {
        const fresh = await refreshTikTokTokens({ clientKey: cfg.clientKey, clientSecret: cfg.clientSecret, refreshToken: cfg.refreshToken });
        await saveTiktokState(
            { status: "connected", error: "", scope: fresh.scope || cfg.scope },
            {
                accessToken: fresh.accessToken,
                refreshToken: fresh.refreshToken || cfg.refreshToken,
                expiresAt: fresh.expiresAt,
                refreshExpiresAt: fresh.refreshExpiresAt || cfg.refreshExpiresAt,
                scope: fresh.scope || cfg.scope,
            }
        );
        return fresh.accessToken;
    } catch (e) {
        const message = "TikTok access was revoked or the refresh token expired. Connect it again in Settings → Integrations.";
        await saveTiktokState({ status: "error", error: message }).catch(() => undefined);
        throw new ProviderError(`${message} ${e instanceof Error ? e.message : ""}`.trim());
    }
}

interface TikTokEnvelope<T> {
    data?: T;
    error?: { code?: string; message?: string; log_id?: string };
}

const envelopeError = (json: TikTokEnvelope<unknown> | null, status: number): string => {
    const code = json?.error?.code ?? "";
    if (code === "access_token_invalid") return "TikTok access token is invalid. Connect TikTok again.";
    if (code === "scope_not_authorized") return "The TikTok app is not approved for this scope. Check the app review in TikTok for Developers.";
    if (code === "scope_permission_missed") return "The TikTok account did not grant the required scope. Connect again and allow video publishing.";
    if (code === "rate_limit_exceeded") return "TikTok rate limit exceeded. Try again later.";
    if (code === "internal_error") return "TikTok internal error. Try again later.";
    return `TikTok: ${json?.error?.message || code || `HTTP ${status}`}`;
};

async function tiktokJson<T>(url: string, init: RequestInit, timeoutMs = 30000): Promise<T> {
    const res = await fetchProvider(url, {
        ...init,
        headers: {
            Authorization: `Bearer ${(init.headers as Record<string, string> | undefined)?.Authorization ?? ""}`,
            "Content-Type": "application/json; charset=UTF-8",
            ...(init.headers as Record<string, string> | undefined),
        },
    }, timeoutMs);
    const json = (await res.json().catch(() => null)) as TikTokEnvelope<T> | null;
    const code = json?.error?.code ?? "";
    if (!res.ok || (code && code !== "ok")) throw new ProviderError(envelopeError(json, res.status));
    if (!json?.data) throw new ProviderError("TikTok returned an empty response");
    return json.data;
}

export async function tiktokUserInfo(accessToken: string): Promise<{ openId: string; displayName: string }> {
    const data = await tiktokJson<{ user?: { open_id?: string; display_name?: string } }>(
        `${API}/user/info/?fields=open_id,display_name`,
        { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
        20000
    );
    return { openId: data.user?.open_id ?? "", displayName: data.user?.display_name ?? "" };
}

export async function tiktokCreatorInfo(accessToken: string): Promise<{
    privacyLevelOptions: string[];
    maxVideoPostDurationSec: number;
}> {
    const data = await tiktokJson<{
        privacy_level_options?: string[];
        max_video_post_duration_sec?: number;
    }>(`${API}/post/publish/creator_info/query/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: "{}",
    }, 20000);
    return {
        privacyLevelOptions: Array.isArray(data.privacy_level_options) ? data.privacy_level_options : [],
        maxVideoPostDurationSec: Number(data.max_video_post_duration_sec) || 0,
    };
}

export interface TikTokPostStatus {
    status: string;
    uploadedBytes: number;
    postIds: string[];
}

export async function tiktokPostStatus(accessToken: string, publishId: string): Promise<TikTokPostStatus> {
    const data = await tiktokJson<{
        status?: string;
        uploaded_bytes?: number;
        publicaly_available_post_id?: string[];
        publicly_available_post_id?: string[];
    }>(`${API}/post/publish/status/fetch/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ publish_id: publishId }),
    }, 20000);
    return {
        status: data.status ?? "",
        uploadedBytes: Number(data.uploaded_bytes) || 0,
        postIds: data.publicaly_available_post_id ?? data.publicly_available_post_id ?? [],
    };
}

export interface TikTokChunkPlan {
    chunkSize: number;
    totalChunkCount: number;
}

/**
 * Раскладка файла на куски по правилам TikTok. Экспортируется отдельно: это единственная часть,
 * которую можно проверить без сети (см. tests/socialPublishing.test.ts).
 */
export function tiktokChunkPlan(videoSize: number): TikTokChunkPlan {
    if (!Number.isInteger(videoSize) || videoSize <= 0) throw new ProviderError("TikTok: video file is empty");
    if (videoSize > TIKTOK_MAX_BYTES) throw new ProviderError(`TikTok: video is larger than 4 GB (${videoSize} bytes)`);
    if (videoSize < 5 * MB) return { chunkSize: videoSize, totalChunkCount: 1 };
    if (videoSize <= 64 * MB) return { chunkSize: videoSize, totalChunkCount: 1 };
    if (videoSize <= 128 * MB) {
        const chunkSize = Math.ceil(videoSize / 2);
        return { chunkSize, totalChunkCount: 2 };
    }
    const chunkSize = 64 * MB;
    return { chunkSize, totalChunkCount: Math.floor(videoSize / chunkSize) };
}

export interface TikTokUploadInput {
    accessToken: string;
    bytes: Buffer;
    title: string;
    mode: TikTokMode;
    privacyStatus?: PrivacyStatus;
    confirmPublic?: boolean;
    displayName?: string;
}

export interface TikTokUploadResult {
    publishId: string;
    mode: TikTokMode;
    status: string;
    postId: string;
    url: string;
    privacyLevel: string;
}

/** Загрузка видео в TikTok: init → PUT кусков → (для direct) один запрос статуса. */
export async function uploadTikTokVideo(input: TikTokUploadInput): Promise<TikTokUploadResult> {
    const mode = normalizeTikTokMode(input.mode);
    const size = input.bytes.length;
    if (!size) throw new ProviderError("Video file is empty");
    if (size > TIKTOK_SERVER_MAX_BYTES) {
        throw new ProviderError(`Video is too large for the server: ${Math.round(size / MB)} MB (max ${TIKTOK_SERVER_MAX_BYTES / MB} MB)`);
    }
    const plan = tiktokChunkPlan(size);
    const title = (String(input.title ?? "").trim() || titleFromText(input.title ?? "") || "Firmspace video").slice(0, TIKTOK_MAX_TITLE);
    const requested = normalizePrivacy(input.privacyStatus);
    let privacyLevel = "SELF_ONLY";
    if (mode === "direct") {
        const info = await tiktokCreatorInfo(input.accessToken).catch(() => null);
        const options = info?.privacyLevelOptions ?? [];
        // TikTok не знает «unlisted»: всё, что не public, уходит как SELF_ONLY (видно только автору).
        if (requested === "public" && publicAllowed(requested, input.confirmPublic) && (!options.length || options.includes("PUBLIC_TO_EVERYONE"))) {
            privacyLevel = "PUBLIC_TO_EVERYONE";
        } else if (options.length && !options.includes(privacyLevel)) {
            throw new ProviderError(`TikTok does not allow SELF_ONLY on this account (available: ${options.join(", ")})`);
        }
    }

    const sourceInfo = {
        source: "FILE_UPLOAD",
        video_size: size,
        chunk_size: plan.chunkSize,
        total_chunk_count: plan.totalChunkCount,
    };
    const endpoint = mode === "direct" ? `${API}/post/publish/video/init/` : `${API}/post/publish/inbox/video/init/`;
    const body = mode === "direct"
        ? {
              post_info: {
                  title,
                  privacy_level: privacyLevel,
                  disable_comment: false,
                  disable_duet: false,
                  disable_stitch: false,
              },
              source_info: sourceInfo,
          }
        : { source_info: sourceInfo };

    const init = await tiktokJson<{ publish_id?: string; upload_url?: string }>(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${input.accessToken}` },
        body: JSON.stringify(body),
    }, 30000);
    const publishId = String(init.publish_id ?? "");
    const uploadUrl = String(init.upload_url ?? "");
    if (!publishId || !uploadUrl) throw new ProviderError("TikTok did not return an upload URL and publish id");

    for (let index = 0; index < plan.totalChunkCount; index++) {
        const start = index * plan.chunkSize;
        const end = Math.min(size - 1, start + plan.chunkSize - 1);
        const chunk = input.bytes.subarray(start, end + 1);
        const res = await fetchProvider(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": "video/mp4",
                "Content-Length": String(chunk.length),
                "Content-Range": `bytes ${start}-${end}/${size}`,
            },
            body: new Uint8Array(chunk),
        }, 180_000);
        if (!res.ok) {
            throw new ProviderError(`TikTok upload failed at bytes ${start}-${end}/${size}: HTTP ${res.status}`);
        }
    }

    let postId = "";
    let status = "processing";
    let url = "";
    try {
        const fetched = await tiktokPostStatus(input.accessToken, publishId);
        status = fetched.status || status;
        postId = fetched.postIds[0] ?? "";
        if (postId && input.displayName) url = `https://www.tiktok.com/@${input.displayName}/video/${postId}`;
    } catch {
        // Статус асинхронный: сразу после загрузки TikTok может ещё не отдать post id.
    }
    return { publishId, mode, status, postId, url, privacyLevel };
}
