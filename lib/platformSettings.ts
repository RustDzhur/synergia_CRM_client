import { decryptJSON, encryptJSON, randomToken } from "@/lib/crypto";
import { connectDB } from "@/lib/mongodb";
import PlatformSettings from "@/models/PlatformSettings";

// Приложение Meta — одно на платформу: через него любая фирма подключает свою страницу Facebook
// или номер WhatsApp, и своего приложения у клиента нет. Поэтому ключи хранятся здесь, а не у фирмы.
// Переменные окружения остаются запасным путём: так это уже настроено для рекламных кабинетов,
// и на сервере, где они заданы, настройка из кабинета не нужна.

const KEY = "metaApp";
const ERROR_KEY = "errorBot";

// Бот платформы для отчётов об ошибках: свой отдельный бот (не бот фирмы для переписки с клиентами).
// Чат ищется сам — бот получает сообщение, мы забираем его через getUpdates и запоминаем чат,
// поэтому искать числовой id вручную не нужно.
//
// Рабочие уведомления (посетитель написал, оставил контакт) идут НЕ сюда, а боту самой фирмы —
// у каждой он свой (lib/firmNotify.ts): уведомления о клиентах одной фирмы не должны попадать
// ни другой фирме, ни владельцу платформы.
export interface ErrorBot { botToken: string; chatId: string }

export async function errorBot(): Promise<ErrorBot> {
    const fromEnv = { botToken: process.env.TELEGRAM_BOT_TOKEN ?? "", chatId: process.env.TELEGRAM_ERROR_CHAT_ID ?? "" };
    // Настройка из кабинета важнее переменных окружения: там чат находится сам, а в переменных легко
    // ошибиться — например, вписать id бота, которому Telegram писать не разрешает.
    const doc = await connectDB().then(() => PlatformSettings.findOne({ key: ERROR_KEY })).catch(() => null);
    if (!doc) return fromEnv;
    const secrets = doc.secrets ? decryptJSON<{ botToken?: string }>(doc.secrets) : {};
    return { botToken: String(secrets.botToken || fromEnv.botToken), chatId: String(doc.value || fromEnv.chatId) };
}

/** Сохраняет бота и чат. Пустой токен оставляет прежний: его не показываем и не переписываем зря. */
export async function setErrorBot(botToken: string, chatId: string): Promise<void> {
    await connectDB();
    await PlatformSettings.updateOne(
        { key: ERROR_KEY },
        { $set: { value: chatId.trim(), ...(botToken.trim() ? { secrets: encryptJSON({ botToken: botToken.trim() }) } : {}) } },
        { upsert: true }
    );
}

// ── Вебхук WhatsApp ───────────────────────────────────────────────────────────────────────────────────
// Адрес вебхука у приложения Meta один на всю платформу, поэтому и маркер подтверждения общий:
// его вписывают в Meta один раз, в поле проверки адреса.

const WA_KEY = "whatsappWebhook";

export async function whatsappVerifyToken(): Promise<string> {
    const fromEnv = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
    if (fromEnv) return fromEnv;
    const doc = await connectDB().then(() => PlatformSettings.findOne({ key: WA_KEY })).catch(() => null);
    if (doc?.value) return String(doc.value);
    // маркер создаётся сам при первом обращении, чтобы его не приходилось придумывать вручную
    const token = randomToken(8);
    await PlatformSettings.updateOne({ key: WA_KEY }, { $set: { value: token } }, { upsert: true });
    return token;
}

// configId — идентификатор конфигурации «Facebook Login for Business» (Вход через Facebook → Конфигурации).
// Он открывает окно Embedded Signup: клиент выбирает свой аккаунт WhatsApp в окне Meta и подключается
// в три клика, без создания собственного приложения в Meta for Developers.
export interface MetaApp { appId: string; appSecret: string; configId: string }

export async function metaApp(): Promise<MetaApp> {
    const fromEnv = { appId: process.env.META_APP_ID ?? "", appSecret: process.env.META_APP_SECRET ?? "" };
    const doc = await connectDB().then(() => PlatformSettings.findOne({ key: KEY })).catch(() => null);
    const secrets = doc?.secrets ? decryptJSON<{ appSecret?: string; configId?: string }>(doc.secrets) : {};
    return {
        appId: String(doc?.value || fromEnv.appId),
        appSecret: String(secrets.appSecret || fromEnv.appSecret),
        configId: String(secrets.configId || process.env.META_CONFIG_ID || ""),
    };
}

/** Сохраняет ключи приложения. Пустое значение оставляет прежнее: секрет не показываем и не переписываем зря. */
export async function setMetaApp(appId: string, appSecret: string, configId?: string): Promise<void> {
    await connectDB();
    const doc = await PlatformSettings.findOne({ key: KEY });
    const keep = doc?.secrets ? decryptJSON<{ appSecret?: string; configId?: string }>(doc.secrets) : {};
    const nextSecret = (appSecret.trim() || keep.appSecret) ?? "";
    const nextConfig = (typeof configId === "string" ? configId.trim() : undefined) ?? keep.configId ?? "";
    await PlatformSettings.updateOne(
        { key: KEY },
        { $set: { value: appId.trim(), secrets: encryptJSON({ appSecret: nextSecret, configId: nextConfig }) } },
        { upsert: true }
    );
}
