import { decryptJSON, encryptJSON, randomToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

// Приложение Meta — одно на платформу: через него любая фирма подключает свою страницу Facebook
// или номер WhatsApp, и своего приложения у клиента нет. Поэтому ключи хранятся здесь, а не у фирмы.
// Переменные окружения остаются запасным путём.

const KEY = "metaApp";
const ERROR_KEY = "errorBot";

export interface ErrorBot { botToken: string; chatId: string }

export async function errorBot(): Promise<ErrorBot> {
    const fromEnv = { botToken: process.env.TELEGRAM_BOT_TOKEN ?? "", chatId: process.env.TELEGRAM_ERROR_CHAT_ID ?? "" };
    // Настройка из кабинета важнее переменных окружения
    const doc = await prisma.platformSettings.findUnique({ where: { key: ERROR_KEY } }).catch(() => null);
    if (!doc) return fromEnv;
    const secrets = doc.secrets ? decryptJSON<{ botToken?: string }>(doc.secrets) : {};
    return { botToken: String(secrets.botToken || fromEnv.botToken), chatId: String(doc.value || fromEnv.chatId) };
}

/** Сохраняет бота и чат. Пустой токен оставляет прежний: его не показываем и не переписываем зря. */
export async function setErrorBot(botToken: string, chatId: string): Promise<void> {
    const value = chatId.trim();
    const secrets = botToken.trim() ? { secrets: encryptJSON({ botToken: botToken.trim() }) } : {};
    await prisma.platformSettings.upsert({
        where: { key: ERROR_KEY },
        create: { key: ERROR_KEY, value, ...secrets },
        update: { value, ...secrets },
    });
}

// ── Вебхук WhatsApp ───────────────────────────────────────────────────────────────────────────────────

const WA_KEY = "whatsappWebhook";

export async function whatsappVerifyToken(): Promise<string> {
    const fromEnv = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
    if (fromEnv) return fromEnv;
    const doc = await prisma.platformSettings.findUnique({ where: { key: WA_KEY } }).catch(() => null);
    if (doc?.value) return String(doc.value);
    // маркер создаётся сам при первом обращении, чтобы его не приходилось придумывать вручную
    const token = randomToken(8);
    await prisma.platformSettings.upsert({ where: { key: WA_KEY }, create: { key: WA_KEY, value: token }, update: { value: token } });
    return token;
}

export interface MetaApp { appId: string; appSecret: string; configId: string }

export async function metaApp(): Promise<MetaApp> {
    const fromEnv = { appId: process.env.META_APP_ID ?? "", appSecret: process.env.META_APP_SECRET ?? "" };
    const doc = await prisma.platformSettings.findUnique({ where: { key: KEY } }).catch(() => null);
    const secrets = doc?.secrets ? decryptJSON<{ appSecret?: string; configId?: string }>(doc.secrets) : {};
    return {
        appId: String(doc?.value || fromEnv.appId),
        appSecret: String(secrets.appSecret || fromEnv.appSecret),
        configId: String(secrets.configId || process.env.META_CONFIG_ID || ""),
    };
}

/** Сохраняет ключи приложения. Пустое значение оставляет прежнее: секрет не показываем и не переписываем зря. */
export async function setMetaApp(appId: string, appSecret: string, configId?: string): Promise<void> {
    const doc = await prisma.platformSettings.findUnique({ where: { key: KEY } });
    const keep = doc?.secrets ? decryptJSON<{ appSecret?: string; configId?: string }>(doc.secrets) : {};
    const nextSecret = (appSecret.trim() || keep.appSecret) ?? "";
    const nextConfig = (typeof configId === "string" ? configId.trim() : undefined) ?? keep.configId ?? "";
    const value = appId.trim();
    const secrets = encryptJSON({ appSecret: nextSecret, configId: nextConfig });
    await prisma.platformSettings.upsert({ where: { key: KEY }, create: { key: KEY, value, secrets }, update: { value, secrets } });
}
