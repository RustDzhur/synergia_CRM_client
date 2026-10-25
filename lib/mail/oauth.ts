import jwt from "jsonwebtoken";
import { ProviderError, fetchProvider } from "@/lib/http";
import { ensurePlatformEnv, platformEnvCached } from "@/lib/platformEnv";

export type Vendor = "google" | "microsoft";

// Вход «через Google / Microsoft». Приложения регистрируются у самих провайдеров (Google Cloud Console, Azure),
// а их ключи задаются в окружении. Без ключей кнопки OAuth не показываются — остаётся вход по паролю приложения.
// Адреса можно переопределить (для проверки без настоящих аккаунтов).
const CONFIG = {
    google: {
        // Ключи OAuth-приложения принадлежат платформе (одна пара на всех клиентов): задаются
        // в кабинете администратора (Настройки → Интеграции → Переменные окружения), окружение — фолбэк.
        id: () => platformEnvCached("GOOGLE_CLIENT_ID"),
        secret: () => platformEnvCached("GOOGLE_CLIENT_SECRET"),
        authUrl: () => process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: () => process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token",
        scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
        extra: { access_type: "offline", prompt: "consent" },
    },
    microsoft: {
        id: () => process.env.MS_CLIENT_ID,
        secret: () => process.env.MS_CLIENT_SECRET,
        authUrl: () => process.env.MS_AUTH_URL || "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        tokenUrl: () => process.env.MS_TOKEN_URL || "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        scope: "offline_access Mail.Read Mail.Send User.Read",
        extra: { prompt: "select_account" },
    },
} as const;

/** Подтягивает настройки платформы в кэш перед показом кнопок входа/подключения. */
export const refreshOAuthConfig = () => ensurePlatformEnv();

export const oauthAvailable = () => ({ google: !!(CONFIG.google.id() && CONFIG.google.secret()), microsoft: !!(CONFIG.microsoft.id() && CONFIG.microsoft.secret()) });
export const redirectUri = (origin: string) => `${origin}/api/mail/oauth/callback`;

// Права на файлы OneDrive: читать и записывать файлы пользователя плюс адрес аккаунта.
// Отдельно от почты — согласие на файлы спрашивается только при подключении Online Documents
export const ONEDRIVE_SCOPE = "offline_access Files.ReadWrite User.Read";

// state защищает от подделки запроса: подписан, живёт 10 минут и содержит пользователя, провайдера и язык страницы
export type OAuthPurpose = "mail" | "drive" | "ads" | "gcal" | "onedrive";
export function makeState(userId: string, vendor: Vendor, locale: string, purpose: OAuthPurpose = "mail") {
    return jwt.sign({ sub: userId, v: vendor, l: locale, p: purpose }, process.env.JWT_SECRET as string, { expiresIn: "10m" });
}
export function readState(state: string) {
    try {
        const s = jwt.verify(state, process.env.JWT_SECRET as string) as { sub: string; v: Vendor; l: string; p?: OAuthPurpose };
        const purpose: OAuthPurpose = s.p === "drive" || s.p === "ads" || s.p === "gcal" || s.p === "onedrive" ? s.p : "mail";
        return CONFIG[s.v] ? { ...s, p: purpose } : null;
    } catch {
        return null;
    }
}

// scope — если нужен не тот, что у почты (Google Drive, Google Calendar, Google Ads);
// redirectUri — если у сценария свой адрес возврата (реклама → /api/ads/callback)
export function authorizeUrl(vendor: Vendor, origin: string, state: string, scope?: string, redirectUriOverride?: string) {
    const c = CONFIG[vendor];
    const q = new URLSearchParams({ client_id: c.id() ?? "", redirect_uri: redirectUriOverride || redirectUri(origin), response_type: "code", scope: scope ?? c.scope, state, ...c.extra });
    return `${c.authUrl()}?${q}`;
}

// scope — какие права провайдер выдал на самом деле: согласие можно дать на меньшее, чем запрошено
// (например, к календарю Google — только на чтение), и по нему решается, доступна ли запись.
export interface Tokens { accessToken: string; refreshToken: string; expiresAt: number; scope?: string }

async function tokenRequest(vendor: Vendor, form: Record<string, string>) {
    const c = CONFIG[vendor];
    const body = new URLSearchParams({ client_id: c.id() ?? "", client_secret: c.secret() ?? "", ...form }).toString();
    const attempt = () => fetchProvider(c.tokenUrl(), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }, 20000);
    let res: Response;
    try {
        res = await attempt();
    } catch (e) {
        // Обмен кода/токена можно безопасно повторить: повторный запрос не создаёт дублей.
        if (e instanceof ProviderError && /did not respond/i.test(e.message)) {
            await new Promise((r) => setTimeout(r, 800));
            res = await attempt();
        } else {
            throw e;
        }
    }
    const json = (await res.json().catch(() => null)) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string; error?: string } | null;
    if (!res.ok || !json?.access_token) throw new ProviderError(json?.error_description || json?.error || "Sign-in was rejected by the provider");
    return { accessToken: json.access_token, refreshToken: json.refresh_token ?? "", expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000, scope: json.scope ?? "" };
}

export const exchangeCode = (vendor: Vendor, code: string, origin: string, customRedirectUri?: string) =>
    tokenRequest(vendor, { grant_type: "authorization_code", code, redirect_uri: customRedirectUri || redirectUri(origin) });

/** Адрес возврата для рекламных подключений: отдельный путь, чтобы в адресной строке не было «почты». */
export const adsRedirectUri = (origin: string) => `${origin}/api/ads/callback`;

export async function refreshTokens(vendor: Vendor, refreshToken: string): Promise<Tokens> {
    const t = await tokenRequest(vendor, { grant_type: "refresh_token", refresh_token: refreshToken });
    return { ...t, refreshToken: t.refreshToken || refreshToken }; // Google не всегда присылает refresh_token заново
}
