import { decryptJSON, encryptJSON } from "@/lib/crypto";
import { ProviderError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { normalizeTikTokMode, type TikTokMode } from "./types";

// Публикация в соцсети платформы (страница Facebook Firmspace и связанный с ней аккаунт Instagram).
// Токен страницы НЕ хранится в коде и не берется из переменных окружения: он читается из базы. Порядок:
//   1) настройка платформы platformsettings/social — значение JSON { pageId, igUserId }, секрет { pageToken };
//   2) уже подключённый канал Messenger этой же страницы (таблица integrations, секрет pageAccessToken) —
//      у платформы одна страница и один токен, дублировать секрет во второй настройке незачем;
//   3) переменные SOCIAL_PAGE_TOKEN / SOCIAL_PAGE_ID / SOCIAL_IG_USER_ID — запасной путь для локальной проверки.
// Идентификаторы страницы и аккаунта Instagram — публичные числа, не секреты; их можно переопределить настройкой.
//
// YouTube и TikTok подключены к той же платформе (не к клиентской фирме), поэтому их токены тоже лежат в
// platformsettings: ключи youtube и tiktok. Несекретные настройки (id канала, имя автора, адрес возврата) —
// в поле value, токены и client secret — в secrets, зашифрованном AES-256-GCM (lib/crypto.ts).

export const DEFAULT_PAGE_ID = "1334056129793648";
export const DEFAULT_IG_USER_ID = "17841462923280272";
const SETTINGS_KEY = "social";
export const YOUTUBE_SETTINGS_KEY = "youtube";
export const TIKTOK_SETTINGS_KEY = "tiktok";

export interface SocialTarget {
    pageId: string;
    pageToken: string;
    igUserId: string;
    source: "settings" | "messenger" | "env";
}

type StoredSocial = { pageId?: string; igUserId?: string };
type StoredSecrets = { pageToken?: string };

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function socialTarget(): Promise<SocialTarget> {
    const row = await prisma.platformSettings.findUnique({ where: { key: SETTINGS_KEY } }).catch(() => null);
    let stored: StoredSocial = {};
    if (row?.value) {
        try {
            stored = JSON.parse(row.value) as StoredSocial;
        } catch {
            stored = {};
        }
    }
    const secrets = (() => {
        if (!row?.secrets) return {} as StoredSecrets;
        try {
            return decryptJSON<StoredSecrets>(row.secrets);
        } catch {
            // ключ шифрования сменили — секрет нечитаем, работаем по данным канала
            return {} as StoredSecrets;
        }
    })();

    const pageId = trim(stored.pageId) || trim(process.env.SOCIAL_PAGE_ID) || DEFAULT_PAGE_ID;
    const igUserId = trim(stored.igUserId) || trim(process.env.SOCIAL_IG_USER_ID) || DEFAULT_IG_USER_ID;

    const fromSetting = trim(secrets.pageToken);
    if (fromSetting) return { pageId, pageToken: fromSetting, igUserId, source: "settings" };

    const channels = await prisma.integration.findMany({ where: { type: "messenger" } }).catch(() => []);
    const channel = channels.find((i) => String((i.config as { pageId?: string } | null)?.pageId ?? "") === pageId);
    let channelToken = "";
    if (channel?.secrets) {
        try {
            const s = decryptJSON<{ pageAccessToken?: string; accessToken?: string }>(channel.secrets);
            channelToken = trim(s.pageAccessToken) || trim(s.accessToken);
        } catch {
            channelToken = "";
        }
    }
    if (channelToken) return { pageId, pageToken: channelToken, igUserId, source: "messenger" };

    const fromEnv = trim(process.env.SOCIAL_PAGE_TOKEN);
    if (fromEnv) return { pageId, pageToken: fromEnv, igUserId, source: "env" };

    throw new ProviderError(
        "No Facebook page token for social publishing: connect the page in Settings → Integrations → Messenger (it stores the Page access token) or add platform settings social with an encrypted pageToken"
    );
}

// ── Общее чтение/запись настроек платформы ───────────────────────────────────────────────────────────────

type StoredRow = { value: string | null; secrets: string | null } | null;

async function readRow(key: string): Promise<StoredRow> {
    const row = await prisma.platformSettings.findUnique({ where: { key } }).catch(() => null);
    return row ? { value: row.value, secrets: row.secrets } : null;
}

function parseValue<T extends object>(row: StoredRow): Partial<T> {
    if (!row?.value) return {};
    try {
        const parsed = JSON.parse(row.value) as unknown;
        return parsed && typeof parsed === "object" ? (parsed as Partial<T>) : {};
    } catch {
        return {};
    }
}

function parseSecrets<T extends object>(row: StoredRow): Partial<T> {
    if (!row?.secrets) return {};
    try {
        return decryptJSON<Partial<T>>(row.secrets);
    } catch {
        return {};
    }
}

async function writeRow(key: string, value: object, secrets: object): Promise<void> {
    const valueText = JSON.stringify(value);
    const secretText = encryptJSON(secrets);
    await prisma.platformSettings.upsert({
        where: { key },
        create: { key, value: valueText, secrets: secretText },
        update: { value: valueText, secrets: secretText },
    });
}

// ── YouTube ───────────────────────────────────────────────────────────────────────────────────────────────

export interface OAuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scope: string;
}

export interface YoutubeState {
    channelId: string;
    channelTitle: string;
    connectedAt: string;
    /** connected | error | "" (ещё не подключали) */
    status: string;
    error: string;
    scope: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

const emptyYoutube = (): YoutubeState => ({
    channelId: "",
    channelTitle: "",
    connectedAt: "",
    status: "",
    error: "",
    scope: "",
    accessToken: "",
    refreshToken: "",
    expiresAt: 0,
});

export async function youtubeState(): Promise<YoutubeState> {
    const row = await readRow(YOUTUBE_SETTINGS_KEY);
    const value = parseValue<YoutubeState>(row);
    const secrets = parseSecrets<OAuthTokens>(row);
    const base = emptyYoutube();
    return {
        ...base,
        channelId: trim(value.channelId),
        channelTitle: trim(value.channelTitle),
        connectedAt: trim(value.connectedAt),
        status: trim(value.status),
        error: trim(value.error),
        scope: trim(value.scope) || trim(secrets.scope),
        accessToken: trim(secrets.accessToken),
        refreshToken: trim(secrets.refreshToken),
        expiresAt: Number(secrets.expiresAt) || 0,
    };
}

/** Сохраняет подключение YouTube, не затирая поля, которых нет в патче. */
export async function saveYoutubeState(valuePatch: Partial<YoutubeState>, secretsPatch: Partial<OAuthTokens> = {}): Promise<void> {
    const row = await readRow(YOUTUBE_SETTINGS_KEY);
    const value = { ...parseValue<YoutubeState>(row), ...valuePatch };
    const secrets = { ...parseSecrets<OAuthTokens>(row), ...secretsPatch };
    await writeRow(YOUTUBE_SETTINGS_KEY, value, secrets);
}

// ── TikTok ────────────────────────────────────────────────────────────────────────────────────────────────

export interface TiktokState {
    /** client_key приложения TikTok for Developers — не секрет, показываем в настройках. */
    clientKey: string;
    /** Адрес возврата, ровно он должен быть в кабинете TikTok (Production → Redirect URI). */
    redirectUri: string;
    /** user.info.basic,video.upload,video.publish — можно сузить, если приложение ещё не прошло review. */
    scopes: string;
    /** inbox — загрузка в черновики, direct — прямая публикация. По умолчанию inbox: безопаснее. */
    mode: TikTokMode;
    openId: string;
    displayName: string;
    connectedAt: string;
    status: string;
    error: string;
    scope: string;
    clientSecret: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    refreshExpiresAt: number;
}

const emptyTiktok = (): TiktokState => ({
    clientKey: "",
    redirectUri: "",
    scopes: "",
    mode: "inbox",
    openId: "",
    displayName: "",
    connectedAt: "",
    status: "",
    error: "",
    scope: "",
    clientSecret: "",
    accessToken: "",
    refreshToken: "",
    expiresAt: 0,
    refreshExpiresAt: 0,
});

export async function tiktokState(): Promise<TiktokState> {
    const row = await readRow(TIKTOK_SETTINGS_KEY);
    const value = parseValue<TiktokState>(row);
    const secrets = parseSecrets<TiktokState>(row);
    const base = emptyTiktok();
    return {
        ...base,
        clientKey: trim(value.clientKey),
        redirectUri: trim(value.redirectUri),
        scopes: trim(value.scopes),
        mode: normalizeTikTokMode(value.mode),
        openId: trim(value.openId),
        displayName: trim(value.displayName),
        connectedAt: trim(value.connectedAt),
        status: trim(value.status),
        error: trim(value.error),
        scope: trim(value.scope) || trim(secrets.scope),
        clientSecret: trim(secrets.clientSecret),
        accessToken: trim(secrets.accessToken),
        refreshToken: trim(secrets.refreshToken),
        expiresAt: Number(secrets.expiresAt) || 0,
        refreshExpiresAt: Number(secrets.refreshExpiresAt) || 0,
    };
}

export async function saveTiktokState(valuePatch: Partial<TiktokState>, secretsPatch: Partial<TiktokState> = {}): Promise<void> {
    const row = await readRow(TIKTOK_SETTINGS_KEY);
    const value = { ...parseValue<TiktokState>(row), ...valuePatch };
    const secrets = { ...parseSecrets<TiktokState>(row), ...secretsPatch };
    await writeRow(TIKTOK_SETTINGS_KEY, value, secrets);
}
