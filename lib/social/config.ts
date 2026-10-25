import { decryptJSON } from "@/lib/crypto";
import { ProviderError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// Публикация в соцсети платформы (страница Facebook Firmspace и связанный с ней аккаунт Instagram).
// Токен страницы НЕ хранится в коде и не берется из переменных окружения: он читается из базы. Порядок:
//   1) настройка платформы platformsettings/social — значение JSON { pageId, igUserId }, секрет { pageToken };
//   2) уже подключённый канал Messenger этой же страницы (таблица integrations, секрет pageAccessToken) —
//      у платформы одна страница и один токен, дублировать секрет во второй настройке незачем;
//   3) переменные SOCIAL_PAGE_TOKEN / SOCIAL_PAGE_ID / SOCIAL_IG_USER_ID — запасной путь для локальной проверки.
// Идентификаторы страницы и аккаунта Instagram — публичные числа, не секреты; их можно переопределить настройкой.

export const DEFAULT_PAGE_ID = "1334056129793648";
export const DEFAULT_IG_USER_ID = "17841462923280272";
const SETTINGS_KEY = "social";

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
